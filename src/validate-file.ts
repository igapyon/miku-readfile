import { hasParentSegment } from "./path-security.js";
import { fail, isPositiveInteger, isRecord, isSupportedEncoding, unknownKeys } from "./validation-common.js";
import type { EffectiveFileRequest } from "./types.js";
import type { ValueResult } from "./validation-common.js";

export function validateFile(entry: unknown, fieldPath: string): ValueResult<EffectiveFileRequest> {
  if (typeof entry === "string") {
    const pathCheck = validateRelativeFilePath(entry, fieldPath);
    if (!pathCheck.ok) return pathCheck;
    return { ok: true, value: { path: entry, range: null, encoding: null } };
  }
  if (!isRecord(entry)) return fail("validation_error", "file entry must be a string or object", fieldPath);
  const unknown = unknownKeys(entry, { path: true, range: { startLine: true, lineCount: true }, encoding: true });
  if (unknown) return fail("validation_error", `unknown file entry field: ${unknown}`, `${fieldPath}.${unknown}`);
  if (typeof entry.path !== "string") return fail("validation_error", "file path is required", `${fieldPath}.path`);
  const pathCheck = validateRelativeFilePath(entry.path, `${fieldPath}.path`);
  if (!pathCheck.ok) return pathCheck;

  let range = null;
  if (entry.range !== undefined) {
    if (!isRecord(entry.range)) return fail("validation_error", "range must be an object", `${fieldPath}.range`);
    const unknownRange = unknownKeys(entry.range, { startLine: true, lineCount: true });
    if (unknownRange) return fail("validation_error", `unknown range field: ${unknownRange}`, `${fieldPath}.range.${unknownRange}`);
    if (!isPositiveInteger(entry.range.startLine)) return fail("validation_error", "range.startLine must be an integer greater than or equal to 1", `${fieldPath}.range.startLine`);
    if (!isPositiveInteger(entry.range.lineCount)) return fail("validation_error", "range.lineCount must be an integer greater than or equal to 1", `${fieldPath}.range.lineCount`);
    range = { startLine: entry.range.startLine, lineCount: entry.range.lineCount };
  }

  let encoding = null;
  if (entry.encoding !== undefined) {
    if (!isSupportedEncoding(entry.encoding)) return fail("validation_error", "unsupported file encoding", `${fieldPath}.encoding`);
    encoding = entry.encoding;
  }
  return { ok: true, value: { path: entry.path, range, encoding } };
}

function validateRelativeFilePath(filePath: string, fieldPath: string): ValueResult<true> {
  if (filePath.length === 0) return fail("validation_error", "file path must not be empty", fieldPath);
  if (filePath.includes("\\")) return fail("validation_error", "file path must use / as separator", fieldPath);
  if (filePath.startsWith("/") || filePath.startsWith("//") || /^[A-Za-z]:\//.test(filePath)) return fail("validation_error", "absolute file paths are not allowed", fieldPath);
  if (hasParentSegment(filePath)) return fail("validation_error", "file path must not contain .. path segments", fieldPath);
  return { ok: true, value: true };
}
