"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FcmProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FcmProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const admin = __importStar(require("firebase-admin"));
let FcmProvider = FcmProvider_1 = class FcmProvider {
    config;
    logger = new common_1.Logger(FcmProvider_1.name);
    app;
    enabled = false;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        const enabled = this.config.get('notifications.fcm.enabled');
        const projectId = this.config.get('notifications.fcm.projectId');
        const clientEmail = this.config.get('notifications.fcm.clientEmail');
        const privateKey = this.config.get('notifications.fcm.privateKey');
        if (!enabled || !projectId || !clientEmail || !privateKey) {
            this.logger.warn('FCM disabled (set FCM_ENABLED=true and credentials to enable)');
            return;
        }
        try {
            this.app = admin.apps.length
                ? admin.app()
                : admin.initializeApp({
                    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
                });
            this.enabled = true;
            this.logger.log('FCM initialized');
        }
        catch (err) {
            this.logger.error('FCM init failed', err);
        }
    }
    async sendToTokens(tokens, payload) {
        if (!this.enabled || !this.app || tokens.length === 0)
            return [];
        const invalid = [];
        const messaging = this.app.messaging();
        const result = await messaging.sendEachForMulticast({
            tokens,
            notification: { title: payload.title, body: payload.body },
            data: payload.data ?? {},
        });
        result.responses.forEach((res, idx) => {
            if (!res.success) {
                const code = res.error?.code;
                if (code === 'messaging/invalid-registration-token' ||
                    code === 'messaging/registration-token-not-registered') {
                    invalid.push(tokens[idx]);
                }
                else {
                    this.logger.warn(`FCM send failed for token: ${code} ${res.error?.message}`);
                }
            }
        });
        return invalid;
    }
};
exports.FcmProvider = FcmProvider;
exports.FcmProvider = FcmProvider = FcmProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FcmProvider);
//# sourceMappingURL=fcm.provider.js.map