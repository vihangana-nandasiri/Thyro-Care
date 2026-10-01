import { test, expect } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

test("verifyPassword accepts the correct password", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
});

test("verifyPassword rejects a wrong password", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  expect(await verifyPassword("wrong-password", hash)).toBe(false);
});
