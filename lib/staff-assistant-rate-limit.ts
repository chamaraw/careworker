const buckets = new Map<string, { tokens: number; updatedAt: number }>();

const CAPACITY = 24;
const REFILL_PER_MS = CAPACITY / (60 * 1000); // per minute

export function staffAssistantRateLimitTake(userId: string): boolean {
  const now = Date.now();
  let b = buckets.get(userId);
  if (!b) {
    b = { tokens: CAPACITY - 1, updatedAt: now };
    buckets.set(userId, b);
    return true;
  }
  const elapsed = now - b.updatedAt;
  const refill = elapsed * REFILL_PER_MS;
  b.tokens = Math.min(CAPACITY, b.tokens + refill);
  b.updatedAt = now;
  if (b.tokens < 1) {
    buckets.set(userId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(userId, b);
  return true;
}
