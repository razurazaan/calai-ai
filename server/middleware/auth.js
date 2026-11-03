import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not logged in" });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ message: "Session expired, please log in again" });
  }
}
