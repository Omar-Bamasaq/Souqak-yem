import winston from "winston";
import path from "path";
import fs from "fs";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const securityFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message} `;
  if (Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata);
  }
  return msg;
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.metadata({ fillWith: ["userId", "ip", "userAgent", "endpoint", "method", "requestId"] }),
    securityFormat
  ),
  transports: [
    // Security Audit Log (Everything critical)
    new winston.transports.File({ 
      filename: path.join(logDir, "security_audit.log"),
      level: "info"
    }),
    // Error Log
    new winston.transports.File({ 
      filename: path.join(logDir, "error.log"), 
      level: "error" 
    })
  ]
});

// If not in production, also log to console
if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log security events with structured data
 */
export const logSecurityEvent = (message, req, metadata = {}) => {
  const logData = {
    message,
    userId: req.user?.id || "anonymous",
    ip: req.ip || req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
    endpoint: req.originalUrl,
    method: req.method,
    requestId: req.id,
    ...metadata
  };
  logger.info(logData);
};

export default logger;
