import { test, expect } from "bun:test";
import { generateMfaSecret, verifyMfaToken } from "./mfa";
import { TOTP, Secret } from "otpauth";

test("verifyMfaToken accepts a code generated from the same secret", () => {
  const { secret } = generateMfaSecret("patient@example.com");
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  const code = totp.generate();
  expect(verifyMfaToken(secret, code)).toBe(true);
});

test("verifyMfaToken rejects a wrong code", () => {
  const { secret } = generateMfaSecret("patient@example.com");
  expect(verifyMfaToken(secret, "000000")).toBe(false);
});
