"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityCacheService = void 0;
const common_1 = require("@nestjs/common");
let AvailabilityCacheService = class AvailabilityCacheService {
    store = new Map();
    defaultTtlMs = Number(process.env.CLOUDBEDS_CACHE_TTL_MS ?? 5 * 60 * 1000);
    buildKey(parts) {
        return [parts.propertyId, parts.checkin, parts.checkout, parts.currencyCode, parts.lang].join('|');
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
    set(key, value, ttlMs = this.defaultTtlMs) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    invalidate(key) {
        this.store.delete(key);
    }
    prune() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt < now)
                this.store.delete(key);
        }
    }
};
exports.AvailabilityCacheService = AvailabilityCacheService;
exports.AvailabilityCacheService = AvailabilityCacheService = __decorate([
    (0, common_1.Injectable)()
], AvailabilityCacheService);
//# sourceMappingURL=availability-cache.service.js.map