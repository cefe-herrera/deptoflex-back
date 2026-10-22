import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Para endpoints `@Public()` que necesitan saber quién llama si hay token:
 * popula `req.user` cuando el JWT es válido y deja pasar igual si falta o es
 * inválido (la decisión de rechazar queda en el servicio).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user || (undefined as TUser);
  }
}
