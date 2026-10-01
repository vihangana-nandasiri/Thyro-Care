// ponytail: in-memory, per-process sliding window. Fine for a single Next.js
// server instance; move to a shared store (Redis, or a DB table) if this
// ever runs as multiple instances behind a load balancer.
const attempts = new Map<string, number[]>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= max) {
    attempts.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  attempts.set(key, timestamps);
  return false;
}
