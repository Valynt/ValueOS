import winston from "winston";

// Create a logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "valueos-build" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    // Add file transport for CI
    ...(process.env.CI ? [new winston.transports.File({ filename: "build.log" })] : []),
  ],
});

export default logger;
