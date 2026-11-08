/**
 * Contrato del Web Chat de WeSpeak, tal como lo usa su propio widget.
 * No es una API pública documentada: puede cambiar sin aviso.
 */

export interface WespeakImage {
  url: string;
  alt?: string;
}

export interface WespeakCardButton {
  /** Id opaco de WeSpeak (incluye fechas y huéspedes de la consulta). Se devuelve tal cual al tocarlo. */
  id: string;
  title: string;
}

export interface WespeakCarouselCard {
  title?: string;
  imageUrl?: string;
  /** Hasta 5 fotos del alojamiento. */
  images?: string[];
  /** Resumen corto: "*Nombre · Complejo*\nAR$ 142.500\nAmenities…". */
  bodyText?: string;
  /** Detalle largo (incluye si el precio es final y por cuántas noches). */
  sourceText?: string;
  buttons?: WespeakCardButton[];
}

export interface WespeakCarousel {
  bodyText?: string;
  followUpText?: string;
  cards: WespeakCarouselCard[];
}

/** Opciones para elegir complejo; se responden con `hotelSelection`. */
export interface WespeakHotelChoices {
  text?: string;
  options: { id: string; label: string }[];
}

/** Lo que manda el widget de WeSpeak al tocar un botón de tarjeta o una opción de complejo. */
export interface AssistantChatSelection {
  selection?: { messageId: string; buttonId: string; cardIndex: number };
  hotelSelection?: { messageId: string; optionId: string };
}

export interface WespeakLocation {
  name?: string;
  address?: string;
}

export interface WespeakMessage {
  id: string;
  /** `guest` = usuario, `bot` = asistente; cualquier otro valor es un agente humano. */
  role: string;
  /** `reply` o `notice` (aviso del sistema, no cuenta como respuesta). */
  kind?: string;
  at: string;
  text?: string;
  cursor?: string;
  image?: WespeakImage;
  carousel?: Partial<WespeakCarousel>;
  hotelChoices?: Partial<WespeakHotelChoices>;
  location?: WespeakLocation;
}

export interface WespeakSessionResponse {
  token: string;
  conversationId: string;
  hotelName?: string;
  /** Canal Scaledrone donde WeSpeak publica eventos `message` y `typing` de la conversación. */
  realtime?: AssistantChatRealtime;
  transcript?: WespeakMessage[];
}

export interface AssistantChatRealtime {
  channelId: string;
  room: string;
}

export interface WespeakSendResponse {
  accepted?: boolean;
  messageId?: string;
  text?: string;
  at?: string;
}

export interface WespeakMessagesResponse {
  messages?: WespeakMessage[];
  nextCursor?: string | null;
}

/** Mensaje tal como lo devuelve Weflex al front (sin cursores ni datos internos de WeSpeak). */
export interface AssistantChatMessage {
  /** id de Weflex: estable aunque el mensaje pase de pendiente a enviado. */
  id: string;
  /** id del mensaje en WeSpeak; el front lo usa para reemplazar lo que mostró en vivo. */
  externalId?: string;
  clientMsgId?: string;
  role: 'guest' | 'bot' | 'agent';
  kind: 'reply' | 'notice';
  /** `pending`: se está enviando; `failed`: no llegó a WeSpeak y se puede reintentar. */
  status: 'sent' | 'pending' | 'failed';
  error?: string;
  at: string;
  text: string;
  image?: WespeakImage;
  carousel?: WespeakCarousel;
  hotelChoices?: WespeakHotelChoices;
  location?: WespeakLocation;
}

export interface AssistantChatAttachments {
  image?: WespeakImage;
  carousel?: WespeakCarousel;
  hotelChoices?: WespeakHotelChoices;
  location?: WespeakLocation;
}

export interface AssistantChatState {
  assistantName: string;
  /** Últimos mensajes del hilo actual, del más viejo al más nuevo. */
  messages: AssistantChatMessage[];
  /** Hay mensajes más viejos: pedirlos con `GET /assistant-chat/history?before=<id>`. */
  hasMore: boolean;
  /** El último mensaje enviado (que no es aviso) es del usuario: el front debería seguir consultando. */
  awaitingReply: boolean;
  /** Segundos que pidió esperar WeSpeak por límite de requests, si aplica. */
  retryAfterSeconds?: number;
  /** Canal para escuchar en vivo (solo lectura). Al llegar un evento, el front vuelve a pedir el estado con `sync`. */
  realtime?: AssistantChatRealtime;
}

export interface AssistantChatHistoryPage {
  messages: AssistantChatMessage[];
  hasMore: boolean;
}
