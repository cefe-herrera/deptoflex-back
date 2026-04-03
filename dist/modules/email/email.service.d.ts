import { ConfigService } from '@nestjs/config';
export declare class EmailService {
    private configService;
    private resend;
    private fromEmail;
    private readonly logger;
    constructor(configService: ConfigService);
    sendVerificationEmail(email: string, token: string): Promise<boolean>;
    sendPasswordResetEmail(email: string, token: string): Promise<boolean>;
}
