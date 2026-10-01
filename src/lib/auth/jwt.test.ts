import { test, expect, beforeAll } from "bun:test";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signMfaChallenge, signMfaSetup, verifyMfaSetup, verifyMfaChallenge,
} from "./jwt";

beforeAll(() => {
  process.env.JWT_SECRET ??= "test-secret-access";
  process.env.JWT_REFRESH_SECRET ??= "test-secret-refresh";
});

test("MFA challenges cannot be used as sessions or as another challenge type", async()=>{
  const setup=await signMfaSetup("user-1");const challenge=await signMfaChallenge("user-1");
  await expect(verifyAccessToken(setup)).rejects.toThrow();
  await expect(verifyAccessToken(challenge)).rejects.toThrow();
  await expect(verifyMfaSetup(challenge)).rejects.toThrow();
  await expect(verifyMfaChallenge(setup)).rejects.toThrow();
  expect((await verifyMfaSetup(setup)).sub).toBe("user-1");
});

test("access token round-trips subject and role", async () => {
  const token = await signAccessToken({ sub: "user-1", role: "patient" });
  const payload = await verifyAccessToken(token);
  expect(payload.sub).toBe("user-1");
  expect(payload.role).toBe("patient");
});

test("refresh token round-trips subject", async () => {
  const token = await signRefreshToken("user-1");
  const payload = await verifyRefreshToken(token);
  expect(payload.sub).toBe("user-1");
});

test("an access token cannot be verified as a refresh token", async () => {
  const token = await signAccessToken({ sub: "user-1", role: "patient" });
  await expect(verifyRefreshToken(token)).rejects.toThrow();
});
