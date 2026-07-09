// Safe structured logging utility that strips PII/sensitive data

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  message: string;
  level: LogLevel;
  timestamp: string;
  [key: string]: any;
}

// Helper to deeply scrub sensitive keys from objects
function scrubSensitiveData(obj: any, visited = new WeakSet()): any {
  if (!obj || typeof obj !== "object") return obj;
  if (visited.has(obj)) return "[Circular]";
  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubSensitiveData(item, visited));
  }

  const scrubbed: any = {};
  const sensitiveKeys = [
    "password",
    "token",
    "otp",
    "key",
    "secret",
    "phone",
    "email",
    "full_name",
  ];

  for (const key of Object.keys(obj)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      // Partially mask phone numbers and emails, redact passwords completely
      const val = obj[key];
      if (typeof val === "string") {
        if (
          key.toLowerCase().includes("password") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("key")
        ) {
          scrubbed[key] = "[REDACTED]";
        } else if (key.toLowerCase().includes("phone")) {
          scrubbed[key] = val.replace(/.(?=.{4})/g, "*"); // Mask all but last 4 digits
        } else if (key.toLowerCase().includes("email")) {
          const parts = val.split("@");
          if (parts.length === 2) {
            scrubbed[key] = parts[0][0] + "***@" + parts[1];
          } else {
            scrubbed[key] = "[MASKED_EMAIL]";
          }
        } else {
          scrubbed[key] = "[MASKED]";
        }
      } else {
        scrubbed[key] = "[REDACTED]";
      }
    } else {
      scrubbed[key] = scrubSensitiveData(obj[key], visited);
    }
  }

  return scrubbed;
}

function writeLog(level: LogLevel, message: string, meta?: any) {
  const payload: LogPayload = {
    message,
    level,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    if (meta instanceof Error) {
      payload.error = {
        name: meta.name,
        message: meta.message,
        stack: process.env.NODE_ENV !== "production" ? meta.stack : undefined,
      };
    } else {
      payload.meta = scrubSensitiveData(meta);
    }
  }

  // Print structured JSON logs
  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export const logger = {
  info: (message: string, meta?: any) => writeLog("info", message, meta),
  warn: (message: string, meta?: any) => writeLog("warn", message, meta),
  error: (message: string, meta?: any) => writeLog("error", message, meta),
};
