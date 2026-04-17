/**
 * Convert .docx files in a folder into draft audit template JSON (one file per document).
 *
 * Usage:
 *   npm run docx:draft
 *   npm run docx:draft -- /absolute/or/relative/path/to/docx/folder
 *
 * Defaults to ./docs at the project root (only .docx files are read). Outputs to lib/audit-templates/drafts/generated/
 *
 * Uses mammoth HTML for Word tables → TABLE_GRID; instructional paragraphs → INFO_TEXT.
 * Refine DROPDOWN options and required flags in the template builder or pack.ts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { parseAuditTemplateFields } from "../lib/audit-template-schema";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/\.docx?$/i, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "template"
  );
}

function slugifyColumnKey(label: string, i: number): string {
  const x = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return x || `col_${i + 1}`;
}

function htmlCellToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip tags from partial HTML (after tables removed) for paragraph chunking. */
function htmlToPlainFragment(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract non-empty cell texts for the first `maxRows` table rows (in order). */
function parseTableRows(tableHtml: string, maxRows: number): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = trRe.exec(tableHtml)) !== null && rows.length < maxRows) {
    const cells: string[] = [];
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const plain = htmlCellToPlain(cm[1]);
      if (plain.length > 0) cells.push(plain);
    }
    rows.push(cells);
  }
  return rows;
}

function countTableRows(tableHtml: string): number {
  const trRe = /<tr[^>]*>/gi;
  let n = 0;
  while (trRe.exec(tableHtml) !== null) n += 1;
  return n;
}

function cellLooksLikeDayNumber(c: string): boolean {
  const t = c.trim();
  if (/^\d{1,2}$/.test(t)) {
    const n = parseInt(t, 10);
    return n >= 1 && n <= 31;
  }
  const m = /^day\s*(\d{1,2})$/i.exec(t);
  if (m) {
    const n = parseInt(m[1], 10);
    return n >= 1 && n <= 31;
  }
  return false;
}

/** True when the row looks like day numbers 1–31 across columns (paper month grid). */
function isNumericDayHeaderRow(cells: string[]): boolean {
  if (cells.length < 12) return false;
  let dayish = 0;
  for (const c of cells) {
    if (cellLooksLikeDayNumber(c)) dayish += 1;
  }
  const ratio = dayish / cells.length;
  if (ratio >= 0.75) return true;
  if (cells.length >= 20 && ratio >= 0.55) return true;
  return false;
}

function parseTableHeaders(tableHtml: string): string[] {
  const rows = parseTableRows(tableHtml, 1);
  return rows[0] ?? [];
}

function columnTypeFromHeader(label: string): "TEXT" | "NUMBER" | "DATE" {
  const h = label.toLowerCase();
  if (label.length < 50 && /\b(date|d\.o\.b|dob|audit date|check date)\b/.test(h)) return "DATE";
  if (/\b(time|clock)\b/.test(h) && label.length < 30) return "TEXT";
  if (
    /\b(how many|number of|count\b|quantity|temperature|temp\b|°c|°f|degrees|reading|mmhg|bpm|pulse|dosage|mg\b)\b/i.test(
      h
    )
  ) {
    return "NUMBER";
  }
  if (/\b(date|when recorded|recorded on)\b/i.test(h) && label.length < 40) return "DATE";
  return "TEXT";
}

const COLLAPSED_DAY_MATRIX_COLUMNS: Array<{ key: string; label: string; type: string }> = [
  { key: "observation_date", label: "Date", type: "DATE" },
  { key: "time", label: "Time (optional)", type: "TEXT" },
  { key: "readings_notes", label: "Temperatures / readings & initials", type: "TEXTAREA" },
  { key: "action", label: "Action if out of range", type: "TEXT" },
];

function findNumericDayHeaderRow(rows: string[][]): { cells: string[]; rowIndex: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > 0 && isNumericDayHeaderRow(row)) {
      return { cells: row, rowIndex: i };
    }
  }
  return null;
}

function buildTableGridField(seq: number, tableHtml: string, warnSink?: string[]): Record<string, unknown> {
  const rowCells = parseTableRows(tableHtml, 8);
  const firstRow = rowCells[0] ?? [];
  const totalRows = countTableRows(tableHtml);
  const dayHeader = findNumericDayHeaderRow(rowCells);

  if (dayHeader) {
    const rowsBelow = Math.max(0, totalRows - (dayHeader.rowIndex + 1));
    const isTypeB = rowsBelow <= 2;
    const defaultRows = isTypeB
      ? Math.min(31, Math.max(dayHeader.cells.length, 7))
      : 14;
    const suffix = isTypeB
      ? " — one row per calendar day (paper month grid)."
      : " — one row per check.";
    return {
      key: `table_${seq}`,
      label: `Monitoring log (replaces paper day columns)${suffix}`,
      type: "TABLE_GRID",
      columns: COLLAPSED_DAY_MATRIX_COLUMNS,
      defaultRows,
      required: false,
    };
  }

  let headers = firstRow.length > 0 ? firstRow : parseTableHeaders(tableHtml);
  if (headers.length === 0) {
    headers = ["Entry"];
  }
  const usedKeys = new Set<string>();
  const columns = headers.map((label, i) => {
    let key = slugifyColumnKey(label, i);
    let bump = 2;
    const base = key;
    while (usedKeys.has(key)) {
      key = `${base}_${bump++}`;
    }
    usedKeys.add(key);
    return {
      key,
      label: label.length > 120 ? `${label.slice(0, 117)}…` : label,
      type: columnTypeFromHeader(label),
    };
  });

  if (columns.length > 12 && warnSink) {
    warnSink.push(
      `Table ${seq} has ${columns.length} columns${
        columns.length > 20 ? " (wide layout)" : ""
      }; consider manual template edit if this is not a true multi-column form.`
    );
  }

  const tableLabel =
    headers.length <= 4
      ? headers.join(" · ").slice(0, 140)
      : `${headers.slice(0, 3).join(" · ")}… (${headers.length} columns)`;

  return {
    key: `table_${seq}`,
    label: tableLabel || "Table",
    type: "TABLE_GRID",
    columns,
    defaultRows: 1,
    required: false,
  };
}

function guessFieldType(line: string): {
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "YES_NO" | "SECTION_HEADER" | "INFO_TEXT";
  required: boolean;
} {
  const t = line.trim();
  if (!t) return { type: "TEXT", required: false };
  const lower = t.toLowerCase();

  if (t.length <= 90 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
    return { type: "SECTION_HEADER", required: false };
  }
  if (/^(section|part)\s+\d+[:.\s]/i.test(t) && t.length < 120) {
    return { type: "SECTION_HEADER", required: false };
  }
  if (/^(guidance\s*notes?|notes?\s*[–-]|top\s*tips?\b|tips?\b)\s*/i.test(t) && t.length < 140) {
    return { type: "SECTION_HEADER", required: false };
  }

  if (t.endsWith("?") && t.length < 200) {
    return { type: "YES_NO", required: false };
  }

  if (
    /\b(date|d\.o\.b|dob|birthday|when\b|audit date|check date)\b/i.test(lower) &&
    t.length < 80
  ) {
    return { type: "DATE", required: false };
  }
  if (/\b(how many|number of|count\b|quantity)\b/i.test(lower)) {
    return { type: "NUMBER", required: false };
  }

  if (/https?:\/\//.test(t)) {
    return { type: "INFO_TEXT", required: false };
  }

  if (
    /\b(store|retain|keep)\b[\s\S]{0,60}\b(data|records|forms?)\b[\s\S]{0,60}(for\s+)?\d+\s*days?\b/i.test(
      lower
    ) ||
    /\bdata\s+for\s+\d+\s*days?\b/i.test(lower) ||
    /\bstore\s+(completed\s+)?forms?\s+for\s+\d+\s*days?\b/i.test(lower)
  ) {
    return { type: "INFO_TEXT", required: false };
  }
  if (
    t.length < 220 &&
    /\bretention\b/i.test(lower) &&
    /\b(file|store|keep|records?)\b/i.test(lower) &&
    /\b(month|year|period|policy)\b/i.test(lower)
  ) {
    return { type: "INFO_TEXT", required: false };
  }

  if (
    t.length > 60 &&
    /^(ensure|avoid|do not|don't|follow|record|rotate|when |if |note:|tip:|important:|the fridge|the freezer|room temperature|refrigeration|freezing temperature)/i.test(
      t
    )
  ) {
    return { type: "INFO_TEXT", required: false };
  }

  if (
    /\b(means between|should be between|must be between|ideal temperature|target range|good practice to)\b/i.test(
      lower
    ) &&
    t.length > 40
  ) {
    return { type: "INFO_TEXT", required: false };
  }
  if (/\bto be completed\b/i.test(lower)) {
    return { type: "INFO_TEXT", required: false };
  }

  const isDeclarativeSentence =
    t.length > 100 &&
    !t.endsWith(":") &&
    !t.endsWith("?") &&
    !/^(describe|explain|list|detail|summarise|summarize|comments?|notes?|actions?)\b/i.test(lower);

  if (isDeclarativeSentence) {
    return { type: "INFO_TEXT", required: false };
  }

  if (
    t.length > 220 ||
    /^(describe|explain|list|detail|summarise|summarize|comments?|notes?|actions?)\b/i.test(lower)
  ) {
    return { type: "TEXTAREA", required: false };
  }
  return { type: "TEXT", required: false };
}

function splitIntoChunks(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\n+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length > 0) return paragraphs;
  return normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const TABLE_PLACEHOLDER = /^__DOCX_TABLE_(\d+)__$/;

async function docxToDraftEntry(docxPath: string, baseName: string) {
  const buf = await fs.readFile(docxPath);
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });

  const tableHtmls: string[] = [];
  const htmlMarked = html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (full) => {
    tableHtmls.push(full);
    return `\n\n__DOCX_TABLE_${tableHtmls.length - 1}__\n\n`;
  });

  const plainFromHtml = htmlToPlainFragment(htmlMarked);
  const chunks = splitIntoChunks(plainFromHtml);

  const templateCode = slugify(baseName);
  const name = baseName.replace(/\.docx?$/i, "").replace(/[_]+/g, " ").trim() || templateCode;
  const fields: Array<Record<string, unknown>> = [];
  let seq = 0;
  const wideTableWarnings: string[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    const tableMatch = TABLE_PLACEHOLDER.exec(trimmed);
    if (tableMatch) {
      const idx = parseInt(tableMatch[1], 10);
      const tableHtml = tableHtmls[idx];
      if (tableHtml) {
        seq += 1;
        fields.push(buildTableGridField(seq, tableHtml, wideTableWarnings));
      }
      continue;
    }

    const { type, required } = guessFieldType(trimmed);
    seq += 1;
    const key =
      type === "SECTION_HEADER" ? `section_${seq}` : type === "INFO_TEXT" ? `info_${seq}` : `field_${seq}`;

    const label = trimmed.length > 500 ? `${trimmed.slice(0, 497)}…` : trimmed;
    if (type === "SECTION_HEADER") {
      fields.push({ key, label, type: "SECTION_HEADER" });
    } else if (type === "INFO_TEXT") {
      fields.push({ key, label, type: "INFO_TEXT" });
    } else {
      fields.push({ key, label, type, required });
    }
  }

  for (const msg of wideTableWarnings) {
    console.warn(`docx:draft [${templateCode}] ${msg}`);
  }

  if (fields.length === 0) {
    fields.push({
      key: "notes",
      label: "Notes (document had no extractable text — edit this field)",
      type: "TEXTAREA",
      required: false,
    });
  }

  const parsed = parseAuditTemplateFields(fields);
  if (!parsed.ok) {
    throw new Error(`${baseName}: ${parsed.error}`);
  }

  return {
    templateCode,
    name,
    category: "Imported",
    description: `Draft from Word file "${baseName}". Review fields and adjust types before production.`,
    fields: parsed.fields,
  };
}

async function main() {
  const root = process.cwd();
  const inputDir = path.resolve(root, process.argv[2] ?? "docs");
  const outDir = path.join(root, "lib/audit-templates/drafts/generated");

  await fs.mkdir(outDir, { recursive: true });

  let names: string[];
  try {
    names = await fs.readdir(inputDir);
  } catch {
    console.error(`Cannot read folder: ${inputDir}`);
    console.error("Create ./docs or pass a path: npm run docx:draft -- ./path/to/docx");
    process.exit(1);
    return;
  }

  const docxFiles = names.filter((n) => n.toLowerCase().endsWith(".docx"));
  if (docxFiles.length === 0) {
    console.log(`No .docx files in ${inputDir}`);
    console.log("Add files and run again.");
    process.exit(0);
    return;
  }

  const packSlice: unknown[] = [];
  const usedCodes = new Set<string>();
  let failures = 0;

  for (const file of docxFiles.sort()) {
    const full = path.join(inputDir, file);
    try {
      const entry = await docxToDraftEntry(full, file);
      let finalCode = entry.templateCode;
      let bump = 2;
      while (usedCodes.has(finalCode)) {
        finalCode = `${entry.templateCode}_${bump}`;
        bump += 1;
      }
      usedCodes.add(finalCode);
      const entryOut = finalCode === entry.templateCode ? entry : { ...entry, templateCode: finalCode };
      packSlice.push(entryOut);
      const outFile = path.join(outDir, `${finalCode}.json`);
      await fs.writeFile(outFile, JSON.stringify(entryOut, null, 2), "utf8");
      console.log(`Wrote ${path.relative(root, outFile)}`);
    } catch (err) {
      failures += 1;
      console.error(`SKIP ${file}:`, err instanceof Error ? err.message : err);
    }
  }

  const combinedPath = path.join(outDir, "_draft_pack.json");
  await fs.writeFile(combinedPath, JSON.stringify(packSlice, null, 2), "utf8");
  console.log(`\nCombined pack: ${path.relative(root, combinedPath)}`);
  if (failures > 0) {
    console.log(`\n${failures} file(s) failed (see SKIP lines above).`);
  }
  console.log(`
Next steps:
  1. Open each JSON and fix types (add DROPDOWN / required) or use Admin → Edit template → Import fields JSON.
  2. Merge entries into lib/audit-templates/pack.ts (SYSTEM_AUDIT_TEMPLATE_PACK_INPUT), or import in the UI and Save.
  3. Run: npm run test:audit-schema
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
