declare const _default: (() => {
    jwtSecret: string | undefined;
    jwtExpiresIn: string;
    refreshTokenExpiresDays: number;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    jwtSecret: string | undefined;
    jwtExpiresIn: string;
    refreshTokenExpiresDays: number;
}>;
export default _default;
