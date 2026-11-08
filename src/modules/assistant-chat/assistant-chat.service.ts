import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type AssistantChatMessage as MessageRow,
  type AssistantChatSession as SessionRow,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssistantChatAttachments,
  AssistantChatHistoryPage,
  AssistantChatMessage,
  AssistantChatSelection,
  AssistantChatState,
  WespeakCarousel,
  WespeakHotelChoices,
  WespeakMessage,
  WespeakMessagesResponse,
  WespeakSendResponse,
  WespeakSessionResponse,
} from './assistant-chat.types';
import { TokenCipher } from './token-cipher';

const REQUEST_TIMEOUT_MS = 18_000;
/** Mínimo entre consultas a WeSpeak por usuario (polling normal). */
const MIN_POLL_INTERVAL_MS = 1_500;
/** Mínimo cuando el front avisa que llegó un evento en tiempo real (`sync`). */
const MIN_SYNC_INTERVAL_MS = 400;
const MAX_PAGES = 20;
const DEFAULT_RETRY_AFTER_S = 60;
const PAGE_SIZE = 50;
/** WESPEAK_DEBUG_TIMING=1 loguea cuánto tarda cada etapa (base, WeSpeak) para diagnosticar latencia. */
const debugTiming = () => process.env.WESPEAK_DEBUG_TIMING === '1';

/** Estado de trabajo de una sesión durante un request (el token ya descifrado). */
interface SessionCtx {
  userId: string;
  threadId: string;
  token: string | null;
  conversationId: string | null;
  cursor: string | null;
  assistantName: string;
  realtimeChannelId: string | null;
  realtimeRoom: string | null;
}

class WespeakHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(`WeSpeak respondió ${status}`);
  }
}

/**
 * Puente con el asistente de WeSpeak. La sesión (token cifrado, cursor) y el historial
 * se guardan por usuario en la base, así que el chat sobrevive reinicios, funciona con
 * varias instancias y se ve igual desde cualquier dispositivo de la cuenta.
 *
 * Latencia: cada consulta a la base es un round-trip, así que se evita releer lo que ya
 * se tiene en memoria durante el request.
 */
@Injectable()
export class AssistantChatService {
  private readonly logger = new Logger(AssistantChatService.name);
  private readonly cipher: TokenCipher;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.cipher = new TokenCipher(
      this.config.get<string>('wespeak.tokenKey') ?? '',
    );
  }

  private get baseUrl(): string {
    return this.config.get<string>('wespeak.baseUrl')!;
  }

  private get widgetId(): string {
    return this.config.get<string>('wespeak.widgetId') ?? '';
  }

  private assertEnabled() {
    if (!this.widgetId) {
      throw new ServiceUnavailableException(
        'El asistente no está configurado.',
      );
    }
  }

  // ── API pública del servicio ──────────────────────────────────────────────

  /**
   * Últimos mensajes del hilo actual. Si hay sesión, trae lo nuevo de WeSpeak.
   * `sync`: el front recibió un evento en tiempo real y quiere el mensaje ya (intervalo mínimo más corto).
   */
  async getState(userId: string, sync = false): Promise<AssistantChatState> {
    this.assertEnabled();
    const t0 = Date.now();
    // Una sola consulta toma el lock de polling y devuelve la sesión; si no toca consultar, se lee la sesión.
    const locked = await this.tryLockPoll(
      userId,
      sync ? MIN_SYNC_INTERVAL_MS : MIN_POLL_INTERVAL_MS,
    );
    let session =
      locked ??
      (await this.prisma.assistantChatSession.findUnique({
        where: { userId },
      }));
    if (!session) {
      return {
        assistantName: 'Asistente',
        messages: [],
        hasMore: false,
        awaitingReply: false,
      };
    }
    let pendingWrites: Promise<unknown>[] = [];
    if (locked) {
      try {
        ({ session, pendingWrites } = await this.pollLocked(locked));
      } catch (err) {
        // Un fallo al consultar no rompe la vista: se devuelve lo que ya está guardado.
        this.logger.warn(`Polling WeSpeak falló: ${(err as Error).message}`);
      }
    } else if (debugTiming() && session.wespeakToken) {
      this.logger.log(
        '[timing] poll salteado (intervalo mínimo o lock tomado)',
      );
    }
    const tPoll = Date.now();
    // La lectura final y las escrituras que no la afectan (cursor) van en paralelo.
    const [state] = await Promise.all([
      this.buildState(session),
      ...pendingWrites.map((w) =>
        w.catch((e: Error) =>
          this.logger.warn(`Escritura diferida falló: ${e.message}`),
        ),
      ),
    ]);
    if (debugTiming()) {
      this.logger.log(
        `[timing] GET sync=${sync} poll=${tPoll - t0}ms build=${Date.now() - tPoll}ms total=${Date.now() - t0}ms awaiting=${state.awaitingReply}`,
      );
    }
    return state;
  }

  /** Mensajes anteriores a `beforeId`, dentro del mismo hilo. */
  async getHistory(
    userId: string,
    beforeId: string,
  ): Promise<AssistantChatHistoryPage> {
    const ref = await this.prisma.assistantChatMessage.findFirst({
      where: { id: beforeId, userId },
      select: { id: true, threadId: true, sentAt: true },
    });
    if (!ref) throw new NotFoundException('Mensaje no encontrado.');
    const rows = await this.prisma.assistantChatMessage.findMany({
      where: {
        userId,
        threadId: ref.threadId,
        OR: [
          { sentAt: { lt: ref.sentAt } },
          { sentAt: ref.sentAt, id: { lt: ref.id } },
        ],
      },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    });
    return {
      messages: sortForDisplay(rows.slice(0, PAGE_SIZE).map(toDto)),
      hasMore: rows.length > PAGE_SIZE,
    };
  }

  async sendMessage(
    userId: string,
    text: string,
    clientMsgId: string,
    choice: AssistantChatSelection = {},
  ): Promise<AssistantChatState> {
    this.assertEnabled();
    const t0 = Date.now();
    // Una consulta: crea la sesión si falta y guarda el mensaje como pendiente antes de mandarlo
    // (si falla o se recarga la página, queda pendiente/fallido y se puede reintentar).
    const { session, row } = await this.upsertSessionAndPending(
      userId,
      clientMsgId,
      text,
      choice,
    );

    const wait = secondsUntil(session.blockedUntil);
    if (wait > 0) {
      const err = tooManyRequests(wait);
      await this.markFailed(row.id, err.message);
      throw err;
    }
    // Reintento de algo que ya se había confirmado: no se manda de nuevo.
    if (row.externalId) {
      await this.prisma.assistantChatMessage.update({
        where: { id: row.id },
        data: { status: 'sent' },
      });
      return this.buildState(session);
    }

    const ctx = this.ctxFrom(session);
    try {
      if (!ctx.token) await this.openSession(ctx);
      const res = await this.withSessionRetry(ctx, () =>
        this.request<WespeakSendResponse>('POST', '/message', {
          // Se reusa el texto guardado: un reintento manda exactamente lo mismo.
          // Igual con el botón/opción elegida (queda guardada para los reintentos).
          body: {
            token: ctx.token,
            text: row.text,
            clientMsgId,
            ...(row.choice.selection
              ? { selection: row.choice.selection }
              : {}),
            ...(row.choice.hotelSelection
              ? { hotelSelection: row.choice.hotelSelection }
              : {}),
          },
        }),
      );
      if (!res?.accepted || !res.messageId) {
        throw new BadGatewayException(
          'El asistente no confirmó el mensaje. Reintentá.',
        );
      }
      await this.confirmSent(userId, row.id, res, ctx.conversationId);
    } catch (err) {
      const httpErr = await this.toHttpException(err, userId);
      await this.markFailed(row.id, httpErr.message);
      throw httpErr;
    }

    const tSent = Date.now();
    const state = await this.buildState(this.mergeCtx(session, ctx));
    if (debugTiming()) {
      this.logger.log(
        `[timing] POST send=${tSent - t0}ms build=${Date.now() - tSent}ms total=${Date.now() - t0}ms`,
      );
    }
    return state;
  }

  /** Empieza de cero: hilo nuevo en Weflex y sesión nueva en WeSpeak. El hilo anterior queda guardado. */
  async startNewThread(userId: string): Promise<AssistantChatState> {
    this.assertEnabled();
    const session = await this.prisma.assistantChatSession.upsert({
      where: { userId },
      create: { userId },
      update: {
        threadId: randomUUID(),
        wespeakToken: null,
        conversationId: null,
        cursor: null,
        realtimeChannelId: null,
        realtimeRoom: null,
        lastPolledAt: null,
      },
    });
    return this.buildState(session);
  }

  /** Envuelve una operación pública para que los errores de WeSpeak salgan traducidos. */
  async run<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw await this.toHttpException(err, userId);
    }
  }

  // ── Sesión ────────────────────────────────────────────────────────────────

  private ctxFrom(session: SessionRow): SessionCtx {
    return {
      userId: session.userId,
      threadId: session.threadId,
      token: this.cipher.decrypt(session.wespeakToken),
      conversationId: session.conversationId,
      cursor: session.cursor,
      assistantName: session.assistantName,
      realtimeChannelId: session.realtimeChannelId,
      realtimeRoom: session.realtimeRoom,
    };
  }

  /** Copia en la fila lo que cambió durante el request, sin volver a leerla de la base. */
  private mergeCtx(session: SessionRow, ctx: SessionCtx): SessionRow {
    return {
      ...session,
      conversationId: ctx.conversationId,
      cursor: ctx.cursor,
      assistantName: ctx.assistantName,
      realtimeChannelId: ctx.realtimeChannelId,
      realtimeRoom: ctx.realtimeRoom,
    };
  }

  private async openSession(ctx: SessionCtx) {
    const res = await this.request<WespeakSessionResponse>('POST', '/session', {
      body: {
        id: this.widgetId,
        token: ctx.token,
        origin: null,
        firstSeenUrl: `https://chat.wespeak.pro/c/${this.widgetId}`,
      },
    });
    if (!res?.token || !res.conversationId) {
      throw new BadGatewayException('El asistente no abrió la sesión.');
    }

    if (ctx.conversationId && ctx.conversationId !== res.conversationId) {
      // WeSpeak abrió un hilo nuevo: el historial guardado se conserva y el cursor arranca de cero.
      this.logger.warn(
        'WeSpeak abrió una conversación nueva; se perdió la sesión anterior.',
      );
      ctx.cursor = null;
    }
    ctx.token = res.token;
    ctx.conversationId = res.conversationId;
    if (res.hotelName) ctx.assistantName = res.hotelName.slice(0, 100);
    const rt = res.realtime;
    const validRt =
      typeof rt?.channelId === 'string' &&
      typeof rt.room === 'string' &&
      rt.channelId &&
      rt.room;
    ctx.realtimeChannelId = validRt ? rt.channelId.slice(0, 100) : null;
    ctx.realtimeRoom = validRt ? rt.room.slice(0, 255) : null;

    await this.prisma.assistantChatSession.update({
      where: { userId: ctx.userId },
      data: {
        wespeakToken: this.cipher.encrypt(res.token),
        conversationId: ctx.conversationId,
        cursor: ctx.cursor,
        assistantName: ctx.assistantName,
        realtimeChannelId: ctx.realtimeChannelId,
        realtimeRoom: ctx.realtimeRoom,
      },
    });
    await this.ingest(ctx, res.transcript ?? []);
  }

  /** Ante un 401, reabre la sesión con el token guardado y reintenta una vez. */
  private async withSessionRetry<T>(
    ctx: SessionCtx,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof WespeakHttpError && err.status === 401) {
        await this.openSession(ctx);
        return fn();
      }
      throw err;
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  /**
   * Lock de polling en la base (una consulta): solo una instancia consulta WeSpeak por intervalo,
   * y nunca durante un 429. Devuelve la sesión si se tomó el lock, o null si no toca consultar.
   */
  private async tryLockPoll(
    userId: string,
    minIntervalMs: number,
  ): Promise<SessionRow | null> {
    const rows = await this.prisma.$queryRaw<RawSessionRow[]>`
      UPDATE assistant_chat_sessions
         SET last_polled_at = now()
       WHERE user_id = ${userId}::uuid
         AND wespeak_token IS NOT NULL
         AND (last_polled_at IS NULL
              OR last_polled_at <= now() - make_interval(secs => ${minIntervalMs / 1000}::float8))
         AND (blocked_until IS NULL OR blocked_until <= now())
      RETURNING *`;
    return rows[0] ? fromRawSession(rows[0]) : null;
  }

  /** Trae lo nuevo de WeSpeak. Devuelve la sesión actualizada y escrituras que se pueden esperar en paralelo. */
  private async pollLocked(
    session: SessionRow,
  ): Promise<{ session: SessionRow; pendingWrites: Promise<unknown>[] }> {
    const ctx = this.ctxFrom(session);
    const pendingWrites: Promise<unknown>[] = [];
    try {
      // Token ilegible (clave rotada) o sesión sin canal en vivo guardado: se (re)abre la sesión.
      if (!ctx.token || !ctx.realtimeRoom) await this.openSession(ctx);
      await this.withSessionRetry(ctx, () =>
        this.fetchNewMessages(ctx, pendingWrites),
      );
    } catch (err) {
      throw await this.toHttpException(err, session.userId);
    }
    return { session: this.mergeCtx(session, ctx), pendingWrites };
  }

  private async fetchNewMessages(
    ctx: SessionCtx,
    pendingWrites: Promise<unknown>[],
  ) {
    let cursor = ctx.cursor;
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = cursor ? `?since=${encodeURIComponent(cursor)}` : '';
      const res = await this.request<WespeakMessagesResponse>(
        'GET',
        `/messages${query}`,
        {
          bearer: ctx.token!,
        },
      );
      const messages = res?.messages ?? [];
      await this.ingest(ctx, messages);

      const lastCursor =
        [...messages].reverse().find((m) => m.cursor)?.cursor ?? null;
      const next = res?.nextCursor ?? null;
      if (next && next !== cursor) {
        cursor = next;
        continue;
      }
      // Sin nextCursor: el cursor del último mensaje es el siguiente punto de partida.
      if (lastCursor) cursor = lastCursor;
      break;
    }
    if (cursor !== ctx.cursor) {
      ctx.cursor = cursor?.slice(0, 255) ?? null;
      // No afecta la respuesta: se espera en paralelo con la lectura final.
      pendingWrites.push(
        this.prisma.assistantChatSession.update({
          where: { userId: ctx.userId },
          data: { cursor: ctx.cursor },
        }),
      );
    }
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  /**
   * Guarda mensajes de WeSpeak en una sola consulta: inserta los nuevos y, si el id ya existe
   * y algo cambió, lo reemplaza (sin duplicados, aunque dos instancias lo hagan a la vez).
   */
  private async ingest(ctx: SessionCtx, messages: WespeakMessage[]) {
    const byId = new Map<string, WespeakMessage>();
    for (const m of messages)
      if (m?.id) byId.set(String(m.id).slice(0, 100), m);
    if (!byId.size) return;

    const rows = [...byId].map(([externalId, m]) => {
      const d = toRowData(m);
      return {
        external_id: externalId,
        role: d.role,
        kind: d.kind,
        text: d.text,
        attachments: d.attachments,
        sent_at: d.sentAt.toISOString(),
      };
    });
    await this.prisma.$executeRaw`
      INSERT INTO assistant_chat_messages
        (id, user_id, thread_id, external_id, conversation_id, role, kind, text,
         attachments, status, sent_at, created_at, updated_at)
      SELECT gen_random_uuid(), ${ctx.userId}::uuid, ${ctx.threadId}::uuid, x.external_id,
             ${ctx.conversationId}::varchar, x.role, x.kind, x.text, x.attachments, 'sent',
             x.sent_at, now(), now()
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
             AS x(external_id varchar, role varchar, kind varchar, text text,
                  attachments jsonb, sent_at timestamptz)
      ON CONFLICT (user_id, external_id) DO UPDATE
         SET role = EXCLUDED.role,
             kind = EXCLUDED.kind,
             text = EXCLUDED.text,
             attachments = EXCLUDED.attachments,
             sent_at = EXCLUDED.sent_at,
             status = 'sent',
             error = NULL,
             updated_at = now()
       WHERE (assistant_chat_messages.role, assistant_chat_messages.kind,
              assistant_chat_messages.text, assistant_chat_messages.attachments,
              assistant_chat_messages.status)
             IS DISTINCT FROM
             (EXCLUDED.role, EXCLUDED.kind, EXCLUDED.text, EXCLUDED.attachments, 'sent')`;
  }

  /** Marca el mensaje pendiente como enviado. Si el polling ya lo trajo con su id de WeSpeak, se descarta el duplicado. */
  /**
   * Marca el mensaje pendiente como enviado, en una sola sentencia. Si el polling ya lo había
   * traído con su id de WeSpeak, se conserva esa fila (ya está confirmada) y se borra la pendiente.
   * (Borrar el duplicado y actualizar en la misma sentencia choca con la clave única.)
   */
  private async confirmSent(
    userId: string,
    rowId: string,
    res: WespeakSendResponse,
    conversationId: string | null,
  ) {
    const externalId = String(res.messageId).slice(0, 100);
    const at = res.at && !Number.isNaN(Date.parse(res.at)) ? res.at : null;
    const text = typeof res.text === 'string' ? res.text : null;
    await this.prisma.$executeRaw`
      WITH dup AS (
        SELECT 1 FROM assistant_chat_messages
         WHERE user_id = ${userId}::uuid
           AND external_id = ${externalId}::varchar
           AND id <> ${rowId}::uuid
      ), drop_pending AS (
        DELETE FROM assistant_chat_messages
         WHERE id = ${rowId}::uuid AND EXISTS (SELECT 1 FROM dup)
      )
      UPDATE assistant_chat_messages
         SET external_id = ${externalId}::varchar,
             conversation_id = ${conversationId}::varchar,
             status = 'sent',
             error = NULL,
             sent_at = COALESCE(${at}::timestamptz, sent_at),
             text = COALESCE(${text}::text, text),
             updated_at = now()
       WHERE id = ${rowId}::uuid AND NOT EXISTS (SELECT 1 FROM dup)`;
  }

  /** Crea la sesión si no existe y guarda (o reactiva) el mensaje pendiente. Una sola consulta. */
  private async upsertSessionAndPending(
    userId: string,
    clientMsgId: string,
    text: string,
    choice: AssistantChatSelection,
  ): Promise<{
    session: SessionRow;
    row: {
      id: string;
      externalId: string | null;
      text: string;
      choice: AssistantChatSelection;
    };
  }> {
    const choiceJson =
      choice.selection || choice.hotelSelection ? JSON.stringify(choice) : null;
    const rows = await this.prisma.$queryRaw<
      (RawSessionRow & {
        msg_id: string;
        msg_external_id: string | null;
        msg_text: string;
        msg_attachments: AssistantChatSelection | null;
      })[]
    >`
      WITH s AS (
        INSERT INTO assistant_chat_sessions (user_id, thread_id, created_at, updated_at)
        VALUES (${userId}::uuid, gen_random_uuid(), now(), now())
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING *
      ), m AS (
        INSERT INTO assistant_chat_messages
          (id, user_id, thread_id, client_msg_id, role, kind, text, attachments, status,
           sent_at, created_at, updated_at)
        SELECT gen_random_uuid(), s.user_id, s.thread_id, ${clientMsgId}::uuid, 'guest',
               'reply', ${text}::text, ${choiceJson}::jsonb, 'pending', now(), now(), now()
          FROM s
        ON CONFLICT (user_id, client_msg_id) DO UPDATE
           SET status = 'pending', error = NULL, updated_at = now()
        RETURNING id, external_id, text, attachments
      )
      SELECT s.*, m.id AS msg_id, m.external_id AS msg_external_id, m.text AS msg_text,
             m.attachments AS msg_attachments
        FROM s, m`;
    const r = rows[0];
    if (!r) throw new Error('No se pudo guardar el mensaje.');
    return {
      session: fromRawSession(r),
      row: {
        id: r.msg_id,
        externalId: r.msg_external_id,
        text: r.msg_text,
        choice: r.msg_attachments ?? {},
      },
    };
  }

  private async markFailed(rowId: string, message: string) {
    await this.prisma.assistantChatMessage
      .update({
        where: { id: rowId },
        data: { status: 'failed', error: message.slice(0, 300) },
      })
      .catch((e: Error) =>
        this.logger.warn(
          `No se pudo marcar el mensaje como fallido: ${e.message}`,
        ),
      );
  }

  private async buildState(session: SessionRow): Promise<AssistantChatState> {
    const rows = await this.prisma.assistantChatMessage.findMany({
      where: { userId: session.userId, threadId: session.threadId },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    });
    const messages = sortForDisplay(rows.slice(0, PAGE_SIZE).map(toDto));
    const lastReal = [...messages]
      .reverse()
      .find((m) => m.kind !== 'notice' && m.status === 'sent');
    const wait = secondsUntil(session.blockedUntil);
    return {
      assistantName: session.assistantName,
      messages,
      hasMore: rows.length > PAGE_SIZE,
      awaitingReply: lastReal?.role === 'guest',
      ...(wait > 0 ? { retryAfterSeconds: wait } : {}),
      ...(session.realtimeChannelId && session.realtimeRoom
        ? {
            realtime: {
              channelId: session.realtimeChannelId,
              room: session.realtimeRoom,
            },
          }
        : {}),
    };
  }

  // ── HTTP ──────────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: unknown; bearer?: string } = {},
  ): Promise<T> {
    let res: Response;
    const tReq = Date.now();
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(opts.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(opts.bearer ? { Authorization: `Bearer ${opts.bearer}` } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new GatewayTimeoutException(
          'El asistente tardó demasiado en responder. Reintentá.',
        );
      }
      throw new BadGatewayException(
        'No pudimos conectarnos con el asistente. Reintentá.',
      );
    }

    const raw = await res.text();
    if (debugTiming()) {
      this.logger.log(
        `[timing] WeSpeak ${method} ${path.split('?')[0]} ${res.status} ${Date.now() - tReq}ms`,
      );
    }
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }

    if (!res.ok) {
      throw new WespeakHttpError(
        res.status,
        body,
        parseRetryAfter(res.headers.get('retry-after')),
      );
    }
    if (
      body &&
      typeof body === 'object' &&
      (body as { error?: string }).error === 'contact_required'
    ) {
      throw new WespeakHttpError(422, body);
    }
    return body as T;
  }

  /** Traduce errores de WeSpeak a respuestas HTTP de Weflex (y guarda el bloqueo por 429). */
  private async toHttpException(err: unknown, userId: string): Promise<Error> {
    if (!(err instanceof WespeakHttpError)) return err as Error;
    if (err.status === 429) {
      const wait = err.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_S;
      this.logger.warn(`WeSpeak 429: bloqueado ${wait} s`);
      await this.prisma.assistantChatSession
        .update({
          where: { userId },
          data: { blockedUntil: new Date(Date.now() + wait * 1000) },
        })
        .catch(() => undefined);
      return tooManyRequests(wait);
    }
    if ((err.body as { error?: string } | null)?.error === 'contact_required') {
      return new BadRequestException(
        'El asistente pide datos de contacto, y Weflex todavía no los soporta.',
      );
    }
    if (err.status === 401) {
      return new BadGatewayException(
        'No pudimos reabrir la sesión con el asistente. Reintentá.',
      );
    }
    this.logger.warn(
      `WeSpeak ${err.status}: ${JSON.stringify(err.body)?.slice(0, 300)}`,
    );
    return new BadGatewayException(
      'El asistente no está disponible. Reintentá en unos segundos.',
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Fila de `assistant_chat_sessions` tal como la devuelve SQL crudo (snake_case). */
interface RawSessionRow {
  user_id: string;
  thread_id: string;
  wespeak_token: string | null;
  conversation_id: string | null;
  cursor: string | null;
  assistant_name: string;
  realtime_channel_id: string | null;
  realtime_room: string | null;
  last_polled_at: Date | null;
  blocked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

function fromRawSession(r: RawSessionRow): SessionRow {
  return {
    userId: r.user_id,
    threadId: r.thread_id,
    wespeakToken: r.wespeak_token,
    conversationId: r.conversation_id,
    cursor: r.cursor,
    assistantName: r.assistant_name,
    realtimeChannelId: r.realtime_channel_id,
    realtimeRoom: r.realtime_room,
    lastPolledAt: r.last_polled_at,
    blockedUntil: r.blocked_until,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function normalizeRole(role: string): AssistantChatMessage['role'] {
  return role === 'guest' ? 'guest' : role === 'bot' ? 'bot' : 'agent';
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
const httpsUrl = (v: unknown): string | undefined => {
  const s = str(v, 2000);
  return s && /^https:\/\//i.test(s) ? s : undefined;
};

/** Carrusel de WeSpeak saneado: solo los campos que usamos, con largos acotados. */
function toCarousel(c: WespeakMessage['carousel']): WespeakCarousel | null {
  if (!c || !Array.isArray(c.cards)) return null;
  const cards = c.cards
    .filter((card) => card && typeof card === 'object')
    .slice(0, 10)
    .map((card) => {
      const images = Array.isArray(card.images)
        ? card.images
            .map(httpsUrl)
            .filter((u): u is string => !!u)
            .slice(0, 5)
        : [];
      const buttons = Array.isArray(card.buttons)
        ? card.buttons
            .map((btn) => ({
              id: str(btn?.id, 256),
              title: str(btn?.title, 80),
            }))
            .filter(
              (btn): btn is { id: string; title: string } =>
                !!btn.id && !!btn.title,
            )
            .slice(0, 2)
        : [];
      return {
        ...(str(card.title, 256) ? { title: str(card.title, 256) } : {}),
        ...(httpsUrl(card.imageUrl)
          ? { imageUrl: httpsUrl(card.imageUrl) }
          : {}),
        ...(images.length ? { images } : {}),
        ...(str(card.bodyText, 4000)
          ? { bodyText: str(card.bodyText, 4000) }
          : {}),
        ...(str(card.sourceText, 4000)
          ? { sourceText: str(card.sourceText, 4000) }
          : {}),
        ...(buttons.length ? { buttons } : {}),
      };
    });
  if (!cards.length) return null;
  return {
    cards,
    ...(str(c.bodyText, 4000) ? { bodyText: str(c.bodyText, 4000) } : {}),
    ...(str(c.followUpText, 4000)
      ? { followUpText: str(c.followUpText, 4000) }
      : {}),
  };
}

function toHotelChoices(
  h: WespeakMessage['hotelChoices'],
): WespeakHotelChoices | null {
  if (!h || !Array.isArray(h.options)) return null;
  const options = h.options
    .map((o) => ({ id: str(o?.id, 20), label: str(o?.label, 256) }))
    .filter(
      (o): o is { id: string; label: string } =>
        !!o.id && /^hotel-\d{1,2}$/.test(o.id) && !!o.label,
    )
    .slice(0, 20);
  if (!options.length) return null;
  return { options, ...(str(h.text, 4000) ? { text: str(h.text, 4000) } : {}) };
}

function toAttachments(m: WespeakMessage): AssistantChatAttachments | null {
  const carousel = toCarousel(m.carousel);
  const hotelChoices = toHotelChoices(m.hotelChoices);
  const out: AssistantChatAttachments = {
    ...(m.image?.url ? { image: { url: m.image.url, alt: m.image.alt } } : {}),
    ...(carousel ? { carousel } : {}),
    ...(hotelChoices ? { hotelChoices } : {}),
    ...(m.location ? { location: m.location } : {}),
  };
  return Object.keys(out).length ? out : null;
}

function toRowData(m: WespeakMessage) {
  return {
    role: normalizeRole(m.role),
    kind: m.kind === 'notice' ? 'notice' : 'reply',
    text: typeof m.text === 'string' ? m.text : '',
    attachments: toAttachments(m) as Prisma.InputJsonValue | null,
    sentAt: parseDate(m.at),
  };
}

function toDto(row: MessageRow): AssistantChatMessage {
  const raw = (row.attachments ?? {}) as AssistantChatAttachments;
  const att: AssistantChatAttachments =
    row.role === 'guest'
      ? {}
      : {
          ...(raw.image ? { image: raw.image } : {}),
          ...(raw.carousel ? { carousel: raw.carousel } : {}),
          ...(raw.hotelChoices ? { hotelChoices: raw.hotelChoices } : {}),
          ...(raw.location ? { location: raw.location } : {}),
        };
  return {
    id: row.id,
    ...(row.externalId ? { externalId: row.externalId } : {}),
    ...(row.clientMsgId ? { clientMsgId: row.clientMsgId } : {}),
    role: normalizeRole(row.role),
    kind: row.kind === 'notice' ? 'notice' : 'reply',
    status:
      row.status === 'pending' || row.status === 'failed' ? row.status : 'sent',
    ...(row.error ? { error: row.error } : {}),
    at: row.sentAt.toISOString(),
    text: row.text,
    ...att,
  };
}

/** Orden por segundo; en el mismo segundo va primero el usuario, después por id. */
function sortForDisplay(
  messages: AssistantChatMessage[],
): AssistantChatMessage[] {
  const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000) || 0;
  return messages.sort((a, b) => {
    const d = sec(a.at) - sec(b.at);
    if (d !== 0) return d;
    if (a.role === 'guest' && b.role !== 'guest') return -1;
    if (b.role === 'guest' && a.role !== 'guest') return 1;
    return a.id.localeCompare(b.id);
  });
}

function parseDate(value?: string): Date {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function secondsUntil(date: Date | null): number {
  return date ? Math.ceil((date.getTime() - Date.now()) / 1000) : 0;
}

function tooManyRequests(wait: number) {
  return new HttpException(
    `El asistente está recibiendo muchos mensajes. Reintentá en ${wait} s.`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs);
  const date = Date.parse(header);
  if (!Number.isNaN(date))
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}
