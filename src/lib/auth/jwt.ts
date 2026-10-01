import { SignJWT, jwtVerify } from "jose";

export type Role = "patient" | "doctor" | "admin";

export interface SessionPayload {
  sub: string;
  role: Role;
}

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secretKey(process.env.JWT_SECRET!));
}

export async function signRefreshToken(sub: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secretKey(process.env.JWT_REFRESH_SECRET!));
}

export async function verifyAccessToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secretKey(process.env.JWT_SECRET!));
  if (!payload.sub || !["patient","doctor","admin"].includes(String(payload.role)) || payload.purpose) throw new Error("Invalid access token.");
  return { sub: payload.sub as string, role: payload.role as Role };
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(
    token,
    secretKey(process.env.JWT_REFRESH_SECRET!),
  );
  return { sub: payload.sub as string };
}

export async function signMfaChallenge(sub: string): Promise<string> {
  return new SignJWT({ purpose: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secretKey(process.env.JWT_SECRET!));
}

export async function verifyMfaChallenge(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, secretKey(process.env.JWT_SECRET!));
  if (payload.purpose !== "mfa_challenge") throw new Error("Invalid challenge token.");
  return { sub: payload.sub as string };
}

export async function signMfaSetup(sub: string) {
  return new SignJWT({purpose:"mfa_setup"}).setProtectedHeader({alg:"HS256"}).setSubject(sub).setIssuedAt().setExpirationTime("5m").sign(secretKey(process.env.JWT_SECRET!));
}
export async function verifyMfaSetup(token: string) {
  const {payload}=await jwtVerify(token,secretKey(process.env.JWT_SECRET!));
  if (payload.purpose!=="mfa_setup" || !payload.sub) throw new Error("Invalid enrollment token");
  return {sub:payload.sub};
}
