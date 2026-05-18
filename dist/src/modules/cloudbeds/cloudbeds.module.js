"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbedsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const cloudbeds_controller_1 = require("./cloudbeds.controller");
const cloudbeds_service_1 = require("./cloudbeds.service");
const reservation_intents_service_1 = require("./reservation-intents.service");
const availability_snapshots_service_1 = require("./availability-snapshots.service");
const cloudbeds_public_booking_provider_1 = require("./providers/cloudbeds-public-booking.provider");
const booking_provider_interface_1 = require("./providers/booking-provider.interface");
let CloudbedsModule = class CloudbedsModule {
};
exports.CloudbedsModule = CloudbedsModule;
exports.CloudbedsModule = CloudbedsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [cloudbeds_controller_1.CloudbedsController],
        providers: [
            cloudbeds_service_1.CloudbedsService,
            reservation_intents_service_1.ReservationIntentsService,
            availability_snapshots_service_1.AvailabilitySnapshotsService,
            cloudbeds_public_booking_provider_1.CloudbedsPublicBookingProvider,
            {
                provide: booking_provider_interface_1.BOOKING_PROVIDER,
                useExisting: cloudbeds_public_booking_provider_1.CloudbedsPublicBookingProvider,
            },
        ],
        exports: [cloudbeds_service_1.CloudbedsService, reservation_intents_service_1.ReservationIntentsService],
    })
], CloudbedsModule);
//# sourceMappingURL=cloudbeds.module.js.map