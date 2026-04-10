"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
let EmailService = EmailService_1 = class EmailService {
    configService;
    resend;
    fromEmail;
    logger = new common_1.Logger(EmailService_1.name);
    constructor(configService) {
        this.configService = configService;
        const apiKey = this.configService.get('email.resendApiKey');
        this.resend = new resend_1.Resend(apiKey);
        this.fromEmail = this.configService.get('email.fromEmail') ?? 'onboarding@resend.dev';
    }
    async sendVerificationEmail(email, token) {
        const appUrl = this.configService.get('app.url');
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
        }
        catch (e) {
            this.logger.error(`Exception sending verification email to ${email}`, e);
            return false;
        }
    }
    async sendPasswordResetEmail(email, token) {
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
        }
        catch (e) {
            this.logger.error(`Exception sending password reset email to ${email}`, e);
            return false;
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map