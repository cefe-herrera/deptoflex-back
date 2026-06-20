import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);

  app.use(helmet());
  app.use(compression());

  // CORS: orígenes de la app (con credenciales, p/ requests autenticadas) +
  // el motor público de Cloudbeds, que envía el aviso de reserva del embajador
  // al endpoint público /ambassadors/cloudbeds-reservation. Ese aviso NO lleva
  // credenciales ni tokens (no se exponen secretos en el JS público de Cloudbeds).
  const appOrigins = config.get<string[]>('app.allowedOrigins') ?? [];
  const cloudbedsOrigin = config.get<string>('app.cloudbedsOrigin');
  const allowedOrigins = new Set(
    [...appOrigins, cloudbedsOrigin].filter((o): o is string => !!o).map((o) => o.trim()),
  );
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin Origin (curl, server-to-server) y los orígenes listados.
      // Para orígenes no permitidos se deniega sin lanzar error (el navegador bloquea),
      // preservando el comportamiento previo basado en lista de orígenes.
      callback(null, !origin || allowedOrigins.has(origin));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DeptoFlex API')
    .setDescription('API de gestión de propiedades, unidades, embajadores y reservas')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addServer('/api/v1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  console.log(`DeptoFlex API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
