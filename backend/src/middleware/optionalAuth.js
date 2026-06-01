import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_key_change_this_in_production_12345");
    const user = await User.findById(payload.id).lean();
    if (user) {
      req.user = {
        id: user._id.toString(),
        role: user.role,
        name: user.name
      };
    }
  } catch {
    // ignore token errors in optional auth
  }
  next();
}
