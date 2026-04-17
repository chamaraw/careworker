import { z } from "zod";

/** Allowed field types in the audit form builder and renderer. */
export const AUDIT_TEMPLATE_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "YES_NO",
  "DROPDOWN",
  "TABLE_GRID",
  "SECTION_HEADER",
  /** Read-only guidance text (no user input). */
  "INFO_TEXT",
] as const;

/** Column types inside TABLE_GRID (no nested grids). */
export const AUDIT_TEMPLATE_GRID_COLUMN_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "YES_NO",
  "DROPDOWN",
] as const;

const fieldTypeEnum = z.enum(AUDIT_TEMPLATE_FIELD_TYPES);
const gridColumnTypeEnum = z.enum(AUDIT_TEMPLATE_GRID_COLUMN_TYPES);

export const auditTemplateGridColumnSchema = z
  .object({
    key: z.string().min(1, "Column key is required"),
    label: z.string().min(1, "Column label is required"),
    type: gridColumnTypeEnum,
    options: z.array(z.string()).optional(),
    normalMin: z.number().finite().optional(),
    normalMax: z.number().finite().optional(),
    unit: z.string().optional(),
  })
  .strict();

export const auditTemplateFieldSchema = z
  .object({
    key: z.string().min(1, "Field key is required"),
    label: z.string().min(1, "Field label is required"),
    type: fieldTypeEnum,
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    columns: z.array(auditTemplateGridColumnSchema).optional(),
    defaultRows: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === "TABLE_GRID") {
      if (!data.columns?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TABLE_GRID fields must include at least one column",
          path: ["columns"],
        });
      }
    } else if (data.columns != null && data.columns.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only TABLE_GRID fields may have columns",
        path: ["columns"],
      });
    }
    if ((data.type === "DROPDOWN" || data.type === "YES_NO") && data.options !== undefined && data.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DROPDOWN / YES_NO should have at least one option when options are set",
        path: ["options"],
      });
    }
    if (data.type === "INFO_TEXT") {
      if (data.required === true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "INFO_TEXT fields cannot be required",
          path: ["required"],
        });
      }
      if (data.options !== undefined && data.options.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "INFO_TEXT fields must not have options",
          path: ["options"],
        });
      }
      if (data.columns !== undefined && data.columns.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "INFO_TEXT fields must not have columns",
          path: ["columns"],
        });
      }
    }
  });

export const auditTemplateFieldsSchema = z.array(auditTemplateFieldSchema).min(1, "At least one field is required");

export type AuditTemplateFieldParsed = z.infer<typeof auditTemplateFieldSchema>;
export type AuditTemplateFieldsParsed = z.infer<typeof auditTemplateFieldsSchema>;

export const auditPackEntrySchema = z
  .object({
    /** Stable id for pack sync (renames do not create duplicates). */
    templateCode: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/i, "templateCode: letters, numbers, underscore; start with a letter")
      .optional(),
    name: z.string().min(1),
    category: z.string(),
    description: z.string(),
    fields: auditTemplateFieldsSchema,
    /** If true, attach the sample BP AI prompt (pack use only). */
    useBpSampleAiPrompt: z.boolean().optional(),
    /** GLOBAL = all venues & clients; PROPERTY = manager enables per property; SERVICE_USER = assign per person only; CARE_PACKAGE = linked from care packages. */
    assignmentScope: z.enum(["GLOBAL", "PROPERTY", "SERVICE_USER", "CARE_PACKAGE"]).optional(),
  })
  .strict();

export type AuditTemplatePackEntryParsed = z.infer<typeof auditPackEntrySchema>;

export const auditTemplatePackSchema = z.array(auditPackEntrySchema).min(1);

export type ParseAuditTemplateFieldsResult =
  | { ok: true; fields: AuditTemplateFieldsParsed }
  | { ok: false; error: string };

/** Validate unknown JSON as audit template `fields` array (for import and server checks). */
function formatZodError(err: z.ZodError): string {
  return err.issues.map((e) => `${e.path.join(".") || "root"}: ${e.message}`).join("; ");
}

export function parseAuditTemplateFields(input: unknown): ParseAuditTemplateFieldsResult {
  const r = auditTemplateFieldsSchema.safeParse(input);
  if (!r.success) {
    return { ok: false, error: formatZodError(r.error) };
  }
  return { ok: true, fields: r.data };
}

export type ParseAuditPackResult =
  | { ok: true; pack: z.infer<typeof auditTemplatePackSchema> }
  | { ok: false; error: string };

export function parseAuditTemplatePack(input: unknown): ParseAuditPackResult {
  const r = auditTemplatePackSchema.safeParse(input);
  if (!r.success) {
    return { ok: false, error: formatZodError(r.error) };
  }
  return { ok: true, pack: r.data };
}
