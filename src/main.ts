import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import logger from './logger/logger';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


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

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://validator.swagger.io"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
  }));
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

  const config = new DocumentBuilder()
    .setTitle('Optiq Sports Basketball API')
    .setDescription(`
# 🏀 Optiq Sports Basketball API

Welcome to the official backend API for Optiq Sports. This API powers the entire basketball management ecosystem, from tournament organization down to real-time play-by-play stat tracking.

## Authentication & Authorization
All secured endpoints require a valid JWT (JSON Web Token) passed in the \`Authorization\` header as a Bearer token.
- **Roles**: The system relies on Role-Based Access Control (RBAC). The primary roles are \`SUPER_ADMIN\`, \`ADMIN\`, and \`STATISTICIAN\`.
- Certain destructive actions (like deletions) are strictly reserved for Admins/Super Admins.

## Core Modules
- **Tournaments & Matches**: Organize seasons, brackets, and scheduled games.
- **Teams & Players**: Manage rosters, player profiles, and team associations. Features robust deduplication for players.
- **Statdash (Real-time Engine)**:
  - \`/api/statdash/sessions\`: Bootstrap and manage the state of active games.
  - \`/api/statdash/events\`: Submit idempotent play-by-play events (shots, fouls, subs) using optimistic locking (\`expectedVersion\`).
  - \`/api/statdash/projections\`: Retrieve computed box scores and shot charts.
  - \`/api/statdash/realtime\`: Subscribe to Server-Sent Events (SSE) for live game updates.

## Usage Guidelines
- **Idempotency**: All state-mutating Statdash commands require an \`idempotencyKey\` to prevent duplicate events during network retries.
- **Soft Deletes**: The API heavily utilizes soft deletes to maintain historical integrity.

*For support or integration questions, please contact the Optiq engineering team.*
    `)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
      name: 'Authorization',
    },
      'bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
    ],
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    }
  });


  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();

