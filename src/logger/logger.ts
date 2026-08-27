import winston from "winston";
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const { combine, timestamp, errors, json } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: { service: 'basketball-be' },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD hh:mm:ss.SSS A" }),
    isProduction 
      ? json() 
      : nestWinstonModuleUtilities.format.nestLike('basketball-be', {
          colors: true,
          prettyPrint: true,
          processId: true,
        })
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
