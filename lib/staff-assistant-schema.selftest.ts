/**
 * Run: npx tsx lib/staff-assistant-schema.selftest.ts
 */
import assert from "node:assert/strict";
import { parseStaffAssistantRequestBody, staffAssistantRequestSchema } from "./staff-assistant-schema";

const ok = parseStaffAssistantRequestBody({
  pathname: "/staff",
  messages: [{ role: "user", content: "Hello" }],
});
assert.equal(ok.success, true);
if (ok.success) {
  assert.equal(ok.data.mode, "chat");
}

const noKey = parseStaffAssistantRequestBody({});
assert.equal(noKey.success, false);

const parsedDefault = staffAssistantRequestSchema.parse({
  pathname: "/x",
  messages: [{ role: "assistant", content: "Hi" }],
});
assert.equal(parsedDefault.mode, "chat");

console.log("staff-assistant-schema.selftest: ok");
