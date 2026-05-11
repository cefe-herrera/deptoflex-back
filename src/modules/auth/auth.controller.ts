import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Redirect,
  Req,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Resend } from 'resend';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Query } from '@nestjs/common';

@ApiTags('Auth')
@ApiBearerAuth('access-token')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
    description: 'Crea una cuenta con email y contraseña y envía un mail de verificación. Limitado a 5 intentos por minuto por IP.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login con email y contraseña',
    description: 'Autentica al usuario y devuelve `accessToken` + `refreshToken`. Registra user-agent e IP para auditoría. Limitado a 5 intentos por minuto.',
  })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login con Google',
    description: 'Autentica al usuario validando un ID token de Google. Crea la cuenta automáticamente si no existe.',
  })
  googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.authService.googleLogin(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login con Apple',
    description: 'Autentica al usuario validando un identity token de Apple Sign In. Crea la cuenta automáticamente si no existe.',
  })
  appleLogin(@Body() dto: AppleLoginDto, @Req() req: Request) {
    return this.authService.appleLogin(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar tokens',
    description: 'Intercambia un `refreshToken` válido por un nuevo par de tokens (rotación). El refresh anterior queda invalidado.',
  })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Revoca el `refreshToken` enviado, invalidando esa sesión. Otras sesiones del usuario permanecen activas.',
  })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar email (POST)',
    description: 'Confirma el email del usuario usando el token enviado al correo durante el registro.',
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Get('verify-email')
  @Redirect('https://deptoflex-front-jg6i.vercel.app/login', 302)
  @ApiOperation({
    summary: 'Verificar email (GET con redirect)',
    description: 'Variante GET pensada para que el usuario haga click directamente en el link del mail. Verifica el token y redirige al login del frontend.',
  })
  async verifyEmailGet(@Query() query: VerifyEmailDto) {
    await this.authService.verifyEmail(query);
  }

  @Public()
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar reset de contraseña',
    description: 'Envía un mail con un link para resetear la contraseña. Por seguridad responde 200 incluso si el email no existe. Limitado a 3 por minuto.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resetear contraseña',
    description: 'Setea una nueva contraseña usando el token recibido por email en el flujo de forgot-password.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Datos del usuario autenticado',
    description: 'Devuelve el perfil del usuario actual incluyendo roles y datos básicos. Requiere `accessToken` válido.',
  })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getMe(user.id);
  }
}
