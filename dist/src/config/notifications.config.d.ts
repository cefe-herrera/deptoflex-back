declare const _default: (() => {
    fcm: {
        enabled: boolean;
        projectId: string | undefined;
        clientEmail: string | undefined;
        privateKey: string | undefined;
    };
    webpush: {
        enabled: boolean;
        publicKey: string | undefined;
        privateKey: string | undefined;
        subject: string;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    fcm: {
        enabled: boolean;
        projectId: string | undefined;
        clientEmail: string | undefined;
        privateKey: string | undefined;
    };
    webpush: {
        enabled: boolean;
        publicKey: string | undefined;
        privateKey: string | undefined;
        subject: string;
    };
}>;
export default _default;
