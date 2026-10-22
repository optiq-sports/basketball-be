import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  process.env.ENABLE_QUEUE_WORKERS = "true";

  const logger = new Logger("WorkerBootstrap");
  logger.log("Starting StatDash background queue worker process...");

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  app.enableShutdownHooks();

  logger.log(
    "StatDash queue workers successfully started and listening for jobs.",
  );

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Shutting down worker gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
