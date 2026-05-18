"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbedsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const cloudbeds_service_1 = require("./cloudbeds.service");
const reservation_intents_service_1 = require("./reservation-intents.service");
const search_availability_dto_1 = require("./dto/search-availability.dto");
const create_reservation_intent_dto_1 = require("./dto/create-reservation-intent.dto");
let CloudbedsController = class CloudbedsController {
    cloudbeds;
    intents;
    constructor(cloudbeds, intents) {
        this.cloudbeds = cloudbeds;
        this.intents = intents;
    }
    searchAvailability(dto) {
        return this.cloudbeds.searchAvailability(dto);
    }
    createReservationIntent(dto, req, user) {
        return this.intents.create(dto, {
            userId: user?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    findIntent(id) {
        return this.intents.findOne(id);
    }
    async markRedirected(id) {
        await this.intents.markRedirected(id);
    }
};
exports.CloudbedsController = CloudbedsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ booking: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Post)('booking/search'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Buscar disponibilidad y tarifas en Cloudbeds (público)',
        description: 'Consulta el booking engine público de Cloudbeds para una propiedad local mapeada y devuelve habitaciones disponibles con tarifas, fotos, amenities, comparación con OTAs (si está disponible) y mapeo a unidades locales. Cachea resultados 5-15 min y persiste un snapshot de auditoría. Solo lectura: para concretar la reserva se debe usar `POST /reservation-intents` y redirigir al motor oficial. Rate-limited a 30 req/min.',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_availability_dto_1.SearchAvailabilityDto]),
    __metadata("design:returntype", void 0)
], CloudbedsController.prototype, "searchAvailability", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ booking: { limit: 10, ttl: 60_000 } }),
    (0, common_1.Post)('reservation-intents'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Crear intención de reserva y obtener URL de redirección oficial',
        description: 'Re-consulta disponibilidad en Cloudbeds para reducir riesgo de precio/disponibilidad desactualizada, persiste una `ReservationIntent` con status PENDING y devuelve la URL del motor oficial de Cloudbeds donde el usuario debe finalizar la reserva. **Nuestro sistema nunca confirma reservas.** Las intents quedan EXPIRED automáticamente si no se usan dentro de la ventana configurada.',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.CREATED, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_reservation_intent_dto_1.CreateReservationIntentDto, Object, Object]),
    __metadata("design:returntype", void 0)
], CloudbedsController.prototype, "createReservationIntent", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('reservation-intents/:id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obtener una reservation intent',
        description: 'Devuelve el detalle de una intent (estado, redirectUrl, expiración). Útil para reanudar el flujo o auditar.',
    }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CloudbedsController.prototype, "findIntent", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('reservation-intents/:id/redirected'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Marcar intent como redireccionada',
        description: 'Endpoint de tracking: el frontend debe llamarlo cuando efectivamente abre la `redirectUrl` oficial de Cloudbeds. Cambia el status de PENDING a REDIRECTED.',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.NO_CONTENT }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CloudbedsController.prototype, "markRedirected", null);
exports.CloudbedsController = CloudbedsController = __decorate([
    (0, swagger_1.ApiTags)('Booking (Cloudbeds)'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [cloudbeds_service_1.CloudbedsService,
        reservation_intents_service_1.ReservationIntentsService])
], CloudbedsController);
//# sourceMappingURL=cloudbeds.controller.js.map