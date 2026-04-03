"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('app', () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:3001').split(','),
}));
//# sourceMappingURL=app.config.js.map