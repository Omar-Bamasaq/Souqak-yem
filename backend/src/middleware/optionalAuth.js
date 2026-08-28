import User from "../models/User.js";
import { verifyAccessToken } from "../config/jwt.js";

export default async function optionalAuth(req, res, next) {
  const candidates = [];
  if (req.headers.authorization?.startsWith("Bearer ")) {
    candidates.push({ source: "header", token: req.headers.authorization.slice(7).trim() });
  }
  if (req.cookies?.accessToken) {
    candidates.push({ source: "cookie", token: req.cookies.accessToken });
  }
  if (req.cookies?.token) {
    candidates.push({ source: "cookie-legacy", token: req.cookies.token });
  }
  if (req.query?.access_token) {
    candidates.push({ source: "query", token: String(req.query.access_token).trim() });
  }
  if (candidates.length === 0) return next();

  let ok = false;
  for (const cand of candidates) {
    try {
      const payload = verifyAccessToken(cand.token);
      const uid = payload.userId || payload.id;
      if (!uid) continue;
      const user = await User.findById(uid).lean();
      if (user && !user.isDisabled && !user.isDeleted) {
        req.user = {
          id: user._id.toString(),
          role: user.role,
          name: user.name,
        };
        ok = true;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!ok) {
    // ignore token errors in optional auth
  }
  next();
}
