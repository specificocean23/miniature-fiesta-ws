import jwt from "jsonwebtoken";
import { AuthToken } from "./types";

const JWTSecret = process.env.JWT_SECRET || "dev-secret";

export function authenticate(token?: string): AuthToken | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWTSecret) as AuthToken;
  } catch (e) {
    return null;
  }
}
