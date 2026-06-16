import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private resend: Resend;
    private fromEmail: string;
    private readonly logger = new Logger(EmailService.name);

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('email.resendApiKey');
        this.resend = new Resend(apiKey);
        this.fromEmail =
            this.configService.get<string>('email.fromEmail') ?? 'Weflex <no-reply@weflex.com.ar>';
    }

    async sendVerificationEmail(email: string, token: string): Promise<boolean> {
        const appUrl = this.configService.get<string>('app.url');
        const verifyLink = `${appUrl}/api/v1/auth/verify-email?token=${token}`;

        return this.send({
            to: email,
            subject: 'Weflex - Verificá tu email',
            html: this.layout(
                'Verificá tu cuenta',
                `
          <p>Gracias por registrarte en Weflex.</p>
          <p>Hacé click en el botón para confirmar tu dirección de email:</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${verifyLink}" style="${this.buttonStyle()}">Verificar email</a>
          </p>
          <p style="color:#64748b;font-size:13px;">Si no creaste esta cuenta, podés ignorar este mensaje.</p>
        `,
            ),
        });
    }

    async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
        const frontendUrl = this.configService.get<string>('app.frontendUrl');
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        return this.send({
            to: email,
            subject: 'Weflex - Restablecer contraseña',
            html: this.layout(
                'Restablecer contraseña',
                `
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Hacé click en el botón para elegir una nueva contraseña. El enlace expira en 1 hora.</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${resetLink}" style="${this.buttonStyle()}">Restablecer contraseña</a>
          </p>
          <p style="color:#64748b;font-size:13px;">Si no solicitaste esto, ignorá este email. Tu contraseña no cambiará.</p>
        `,
            ),
        });
    }

    async sendNotificationEmail(
        email: string,
        title: string,
        body: string,
        actionUrl?: string,
    ): Promise<boolean> {
        const frontendUrl = this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
        const link = actionUrl?.startsWith('http') ? actionUrl : `${frontendUrl}${actionUrl ?? '/dashboard/notifications'}`;

        const actionBlock = `
          <p style="text-align:center;margin:28px 0;">
            <a href="${link}" style="${this.buttonStyle()}">Ver en Weflex</a>
          </p>
        `;

        return this.send({
            to: email,
            subject: `Weflex - ${title}`,
            html: this.layout(
                title,
                `
          <p>${body}</p>
          ${actionBlock}
          <p style="color:#64748b;font-size:13px;">Podés desactivar estos avisos por email desde tu perfil.</p>
        `,
            ),
        });
    }

    private async send(payload: { to: string; subject: string; html: string }): Promise<boolean> {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: payload.to,
                subject: payload.subject,
                html: payload.html,
            });

            if (error) {
                this.logger.error(`Error sending email to ${payload.to}`, error);
                return false;
            }

            this.logger.log(`Email sent to ${payload.to} (ID: ${data?.id})`);
            return true;
        } catch (e) {
            this.logger.error(`Exception sending email to ${payload.to}`, e);
            return false;
        }
    }

    private buttonStyle(): string {
        return 'display:inline-block;background:#13427E;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;';
    }

    private layout(title: string, body: string): string {
        return `
      <!DOCTYPE html>
      <html lang="es">
        <body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;margin:0;padding:24px;background:#f8fafc;">
          <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#13427E;letter-spacing:0.05em;text-transform:uppercase;">Weflex</p>
            <h1 style="margin:0 0 20px;font-size:22px;color:#13427E;">${title}</h1>
            ${body}
          </div>
        </body>
      </html>
    `;
    }
}
