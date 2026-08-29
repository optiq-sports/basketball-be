import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import logger from './logger/logger';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';

function resolveCorsOrigin():
  | boolean
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => void) {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return true;
  }
  const allowed = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowed.has(origin));
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({ instance: logger }),
  });

  app.use(helmet());
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();

