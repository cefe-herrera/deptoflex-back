import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AppleLoginDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    // Apple only sends name on the FIRST login — capture it here
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;
}
