/**
 * Run: npx tsx lib/audit-template-schema.selftest.ts
 */
import assert from "node:assert/strict";
import {
  auditTemplateFieldsSchema,
  parseAuditTemplateFields,
} from "./audit-template-schema";
import { getSystemAuditTemplatePack } from "./audit-templates/pack";

assert.throws(() => auditTemplateFieldsSchema.parse([]), /At least one field/);

assert.throws(
  () =>
    auditTemplateFieldsSchema.parse([
      { key: "x", label: "X", type: "TABLE_GRID" },
    ]),
  /at least one column/
);

const valid = auditTemplateFieldsSchema.parse([
  { key: "notes", label: "Notes", type: "TEXTAREA", required: true },
]);
assert.equal(valid.length, 1);

auditTemplateFieldsSchema.parse([{ key: "tip1", label: "Read this guidance.", type: "INFO_TEXT" }]);

assert.throws(
  () =>
    auditTemplateFieldsSchema.parse([
      { key: "bad", label: "X", type: "INFO_TEXT", required: true },
    ]),
  /INFO_TEXT fields cannot be required/
);

const badType = parseAuditTemplateFields([{ key: "a", label: "A", type: "INVALID" }]);
assert.equal(badType.ok, false);

getSystemAuditTemplatePack();
console.log("audit-template-schema selftest: ok");
