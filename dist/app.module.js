"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const app_config_1 = __importDefault(require("./config/app.config"));
const auth_config_1 = __importDefault(require("./config/auth.config"));
const r2_config_1 = __importDefault(require("./config/r2.config"));
const email_config_1 = __importDefault(require("./config/email.config"));
const validation_schema_1 = require("./config/validation.schema");
const prisma_module_1 = require("./modules/prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const roles_module_1 = require("./modules/roles/roles.module");
const professionals_module_1 = require("./modules/professionals/professionals.module");
const properties_module_1 = require("./modules/properties/properties.module");
const units_module_1 = require("./modules/units/units.module");
const amenities_module_1 = require("./modules/amenities/amenities.module");
const leads_module_1 = require("./modules/leads/leads.module");
const bookings_module_1 = require("./modules/bookings/bookings.module");
const commissions_module_1 = require("./modules/commissions/commissions.module");
const media_module_1 = require("./modules/media/media.module");
const r2_module_1 = require("./modules/r2/r2.module");
const health_module_1 = require("./modules/health/health.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const roles_guard_1 = require("./common/guards/roles.guard");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [app_config_1.default, auth_config_1.default, r2_config_1.default, email_config_1.default],
                validationSchema: validation_schema_1.validationSchema,
                validationOptions: { abortEarly: true },
            }),
            throttler_1.ThrottlerModule.forRoot([
                { name: 'global', ttl: 60000, limit: 100 },
                { name: 'auth', ttl: 60000, limit: 5 },
            ]),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            r2_module_1.R2Module,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            roles_module_1.RolesModule,
            professionals_module_1.ProfessionalsModule,
            properties_module_1.PropertiesModule,
            units_module_1.UnitsModule,
            amenities_module_1.AmenitiesModule,
            leads_module_1.LeadsModule,
            bookings_module_1.BookingsModule,
            commissions_module_1.CommissionsModule,
            media_module_1.MediaModule,
            health_module_1.HealthModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map