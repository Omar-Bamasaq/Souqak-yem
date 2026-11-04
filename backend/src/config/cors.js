const allowedOrigins = [
  "https://souqak-yem.com",
  "https://www.souqak-yem.com"
];

export function isAllowedCorsOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }
  if (parsedOrigin.origin !== origin) return false;

  return process.env.NODE_ENV !== "production" && parsedOrigin.hostname === "localhost";
}

export function socketAllowRequest(request, callback) {
  const origin = request.headers?.origin;
  callback(null, typeof origin === "string" && isAllowedCorsOrigin(origin));
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedCorsOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token", "Idempotency-Key"],
  exposedHeaders: ["Set-Cookie"]
};
