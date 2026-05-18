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
var CloudbedsPublicBookingProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbedsPublicBookingProvider = void 0;
const common_1 = require("@nestjs/common");
const https = __importStar(require("node:https"));
const node_url_1 = require("node:url");
const cloudbeds_response_schema_1 = require("./cloudbeds-response.schema");
let CloudbedsPublicBookingProvider = CloudbedsPublicBookingProvider_1 = class CloudbedsPublicBookingProvider {
    providerName = 'cloudbeds-public';
    logger = new common_1.Logger(CloudbedsPublicBookingProvider_1.name);
    endpoint = process.env.CLOUDBEDS_BOOKING_ROOMS_URL ?? 'https://hotels.cloudbeds.com/booking/rooms';
    reservationBaseUrl = process.env.CLOUDBEDS_RESERVATION_BASE_URL ?? 'https://hotels.cloudbeds.com';
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
    timeoutMs = Number(process.env.CLOUDBEDS_HTTP_TIMEOUT_MS ?? 10_000);
    async searchAvailability(input) {
        this.logger.log("searchAvailability");
        const body = this.buildFormBody(input);
        const startedAt = Date.now();
        let httpStatus = 0;
        let rawText = '';
        try {
            this.logger.log("httpPost endpoint=" + this.endpoint + " body=" + body);
            const { status, text } = await this.httpPost(this.endpoint, body);
            this.logger.log("httpPost status=" + status + " text=" + text);
            httpStatus = status;
            rawText = text;
            if (status < 200 || status >= 300) {
                this.logger.warn(`Cloudbeds returned non-OK status ${httpStatus} for property=${input.propertyExternalId} body="${rawText.slice(0, 500).replace(/\s+/g, ' ')}"`);
                throw new common_1.ServiceUnavailableException('Booking engine upstream error');
            }
            let json;
            try {
                json = JSON.parse(rawText);
            }
            catch {
                this.logger.error('Cloudbeds returned non-JSON body');
                throw new common_1.ServiceUnavailableException('Booking engine returned invalid response');
            }
            const parseResult = cloudbeds_response_schema_1.CloudbedsResponseSchema.safeParse(json);
            if (!parseResult.success) {
                this.logger.error(`Cloudbeds response failed schema validation: ${parseResult.error.message}`);
                throw new common_1.ServiceUnavailableException('Booking engine returned unexpected payload');
            }
            const durationMs = Date.now() - startedAt;
            return this.normalize(input, parseResult.data, httpStatus, durationMs);
        }
        catch (err) {
            const durationMs = Date.now() - startedAt;
            if (err instanceof common_1.ServiceUnavailableException)
                throw err;
            if (err instanceof Error && err.name === 'AbortError') {
                this.logger.error(`Cloudbeds request timed out after ${durationMs}ms`);
                throw new common_1.ServiceUnavailableException('Booking engine timeout');
            }
            this.logger.error(`Cloudbeds request failed: ${err instanceof Error ? err.message : String(err)}`);
            throw new common_1.ServiceUnavailableException('Booking engine unreachable');
        }
    }
    httpPost(endpoint, body) {
        return new Promise((resolve, reject) => {
            const url = new node_url_1.URL(endpoint);
            const req = https.request({
                method: 'POST',
                host: url.hostname,
                port: url.port || 443,
                path: `${url.pathname}${url.search}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body),
                    'User-Agent': this.userAgent,
                    Accept: '*/*',
                },
                timeout: this.timeoutMs,
            }, (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => {
                    resolve({
                        status: res.statusCode ?? 0,
                        text: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            });
            req.on('timeout', () => req.destroy(new Error('AbortError')));
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    buildReservationRedirectUrl(input) {
        if (!input.bookingSlug) {
            const params = new URLSearchParams({
                widget_property: input.propertyExternalId,
                checkin: input.checkin,
                checkout: input.checkout,
                currency_code: input.currencyCode,
                lang: input.lang,
            });
            return `${this.reservationBaseUrl}/booking?${params.toString()}`;
        }
        const params = new URLSearchParams({
            currency: input.currencyCode.toLowerCase(),
            checkin: input.checkin,
            checkout: input.checkout,
            room_type_id: input.roomTypeId,
        });
        if (input.rateId)
            params.set('rate_id', input.rateId);
        if (input.adults && input.adults > 0)
            params.set('adults', String(input.adults));
        if (input.children && input.children > 0)
            params.set('children', String(input.children));
        return `${this.reservationBaseUrl}/${input.lang}/reservation/${input.bookingSlug}/?${params.toString()}`;
    }
    buildFormBody(input) {
        const params = new URLSearchParams();
        params.set('checkin', input.checkin);
        params.set('checkout', input.checkout);
        params.set('currency_code', input.currencyCode);
        params.set('lang', input.lang);
        params.set('widget_property', input.propertyExternalId);
        return params.toString();
    }
    normalize(input, raw, httpStatus, durationMs) {
        const roomTypes = raw.room_types ?? [];
        const maRates = raw.ma_rates ?? [];
        const rooms = roomTypes.map((rt) => this.normalizeRoom(rt, maRates));
        return {
            propertyExternalId: input.propertyExternalId,
            checkin: input.checkin,
            checkout: input.checkout,
            currencyCode: input.currencyCode,
            totalAvailable: typeof raw.total === 'number' ? raw.total : 0,
            rooms,
            meta: {
                websiteSourceId: raw.website_source_id ?? null,
                currencyRate: raw.currency_rate ?? null,
            },
            raw,
            httpStatus,
            durationMs,
        };
    }
    normalizeRoom(rt, maRates) {
        const detailedRates = (rt.detailed_rates ?? []).map((d) => ({
            date: d.date,
            rate: d.rate,
            baseRate: typeof d.base_rate === 'number' ? d.base_rate : d.rate,
        }));
        const totalAmount = (() => {
            if (typeof rt.rate_basic === 'number' && rt.rate_basic > 0)
                return rt.rate_basic;
            if (detailedRates.length > 0)
                return detailedRates.reduce((acc, r) => acc + r.rate, 0);
            return null;
        })();
        const photosSet = new Set();
        if (rt.featured_photo_big)
            photosSet.add(rt.featured_photo_big);
        if (rt.featured_photo)
            photosSet.add(rt.featured_photo);
        for (const p of rt.photos_gallery ?? []) {
            if (p.length > 0)
                photosSet.add(p);
        }
        const features = rt.features ?? [];
        const unitIds = rt.unit_ids ?? [];
        const remaining = (() => {
            if (typeof rt.remaining === 'number')
                return rt.remaining;
            if (typeof rt.num_available_now === 'number')
                return rt.num_available_now;
            return 0;
        })();
        const ota = this.findOtaComparison(rt, maRates);
        return {
            roomTypeId: String(rt.room_type_id),
            rateId: rt.rate_id != null ? String(rt.rate_id) : null,
            name: rt.room_type_name ?? rt.room_type_title ?? `Room ${rt.room_type_id}`,
            title: rt.room_type_title ?? rt.room_type_name ?? `Room ${rt.room_type_id}`,
            descriptionHtml: rt.room_type_desc ?? null,
            maxGuests: this.toNumber(rt.max_guests),
            maxAdults: this.toNumber(rt.max_adults),
            maxChildren: this.toNumber(rt.max_children),
            remaining,
            totalRooms: typeof rt.max_rooms === 'number' ? rt.max_rooms : 0,
            totalAmount,
            minNightlyRate: typeof rt.rate_min === 'number' ? rt.rate_min : null,
            maxNightlyRate: typeof rt.rate_max === 'number' ? rt.rate_max : null,
            detailedRates,
            photos: Array.from(photosSet),
            featuredPhoto: rt.featured_photo_big ?? rt.featured_photo ?? null,
            features,
            unitIds,
            otaComparison: ota.length > 0 ? ota : undefined,
        };
    }
    findOtaComparison(rt, maRates) {
        if (maRates.length === 0)
            return [];
        const match = maRates.find((m) => m.name === rt.room_type_name ||
            m.name === rt.room_type_title ||
            String(m.id) === String(rt.room_type_id));
        if (!match)
            return [];
        const direct = typeof match.direct === 'number' ? match.direct : 0;
        return (match.rates ?? []).map((r) => ({
            channelName: r.channel_name,
            channelPrice: r.channel_price,
            directPrice: direct,
        }));
    }
    toNumber(value) {
        if (value === undefined || value === null)
            return null;
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : null;
    }
};
exports.CloudbedsPublicBookingProvider = CloudbedsPublicBookingProvider;
exports.CloudbedsPublicBookingProvider = CloudbedsPublicBookingProvider = CloudbedsPublicBookingProvider_1 = __decorate([
    (0, common_1.Injectable)()
], CloudbedsPublicBookingProvider);
//# sourceMappingURL=cloudbeds-public-booking.provider.js.map