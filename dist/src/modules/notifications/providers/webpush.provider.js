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
var WebPushProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPushProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const webpush = __importStar(require("web-push"));
let WebPushProvider = WebPushProvider_1 = class WebPushProvider {
    config;
    logger = new common_1.Logger(WebPushProvider_1.name);
    enabled = false;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        const enabled = this.config.get('notifications.webpush.enabled');
        const publicKey = this.config.get('notifications.webpush.publicKey');
        const privateKey = this.config.get('notifications.webpush.privateKey');
        const subject = this.config.get('notifications.webpush.subject');
        if (!enabled || !publicKey || !privateKey) {
            this.logger.warn('Web Push disabled (set WEBPUSH_ENABLED=true and VAPID keys to enable)');
            return;
        }
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.enabled = true;
        this.logger.log('Web Push initialized');
    }
    async sendToSubscriptions(subs, payload) {
        if (!this.enabled || subs.length === 0)
            return [];
        const invalid = [];
        const body = JSON.stringify(payload);
        await Promise.all(subs.map(async (sub) => {
            try {
                await webpush.sendNotification(sub, body);
            }
            catch (err) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    invalid.push(sub.endpoint);
                }
                else {
                    this.logger.warn(`Web Push failed: ${err.statusCode} ${err.message}`);
                }
            }
        }));
        return invalid;
    }
};
exports.WebPushProvider = WebPushProvider;
exports.WebPushProvider = WebPushProvider = WebPushProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WebPushProvider);
//# sourceMappingURL=webpush.provider.js.map