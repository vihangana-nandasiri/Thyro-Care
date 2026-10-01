import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";

function totpFor(secretBase32: string, label = "ThyroCare AI"): TOTP {
  return new TOTP({
    issuer: "ThyroCare AI",
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function generateMfaSecret(email: string): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = new Secret({ size: 20 });
  const totp = totpFor(secret.base32, email);
  return { secret: secret.base32, otpauthUrl: totp.toString() };
}

export function verifyMfaToken(secretBase32: string, token: string): boolean {
  const totp = totpFor(secretBase32);
  return totp.validate({ token, window: 1 }) !== null;
}

export function qrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}
