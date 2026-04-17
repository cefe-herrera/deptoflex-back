import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private config;
    private readonly client;
    private readonly bucket;
    private readonly publicBaseUrl;
    constructor(config: ConfigService);
    generatePresignedPutUrl(objectKey: string, contentType: string, expiresIn?: number): Promise<string>;
    objectExists(objectKey: string): Promise<boolean>;
    deleteObject(objectKey: string): Promise<void>;
    getPublicUrl(objectKey: string): string;
    buildObjectKey(entity: 'properties' | 'units' | 'professionals', entityId: string, filename: string): string;
}
