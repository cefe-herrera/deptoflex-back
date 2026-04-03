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
        this.fromEmail = this.configService.get<string>('email.fromEmail') ?? 'onboarding@resend.dev';
    }

    async sendVerificationEmail(email: string, token: string) {
        const appUrl = this.configService.get<string>('app.url');
        const magicLink = `${appUrl}/api/v1/auth/verify-email?token=${token}`;

        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: email,
                subject: 'DeptoFlex - Verification Email',
                html: `
          <h1>Welcome to DeptoFlex!</h1>
          <p>You requested to verify your email. Please click the link below to verify your account:</p>
          <a href="${magicLink}">Verify my email</a>
          <br />
          <p>If you did not request this, please ignore this email.</p>
          <hr />
          <small>Verification token: <code>${token}</code></small>
        `,
            });

            if (error) {
                this.logger.error(`Error sending verification email to ${email}`, error);
                return false;
            }

            this.logger.log(`Verification email sent to ${email} (ID: ${data?.id})`);
            return true;
        } catch (e) {
            this.logger.error(`Exception sending verification email to ${email}`, e);
            return false;
        }
    }

    async sendPasswordResetEmail(email: string, token: string) {
        // In a real scenario, this would be a URL pointing to the frontend
        const resetLink = `http://localhost:3001/reset-password?token=${token}`;

        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: email,
                subject: 'DeptoFlex - Reset your password',
                html: `
          <h1>Password Reset Request</h1>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <a href="${resetLink}">Reset my password</a>
          <br />
          <p>If you did not request this, please ignore this email. Your password will remain the same.</p>
          <hr />
          <small>Reset token: <code>${token}</code></small>
        `,
            });

            if (error) {
                this.logger.error(`Error sending password reset email to ${email}`, error);
                return false;
            }

            this.logger.log(`Password reset email sent to ${email} (ID: ${data?.id})`);
            return true;
        } catch (e) {
            this.logger.error(`Exception sending password reset email to ${email}`, e);
            return false;
        }
    }
}
