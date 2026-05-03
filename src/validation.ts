import { DEFAULTS, LIMITS, REQUEST_SHAPE, VERSION } from "./constants.js";
import { hasParentSegment } from "./path-security.js";
import type {
  EffectiveFileRequest,
  EffectiveRequest,
  FileRequestEntry,
  MikuReadfileRequest,
  SupportedEncoding,
  ValidationResult,
} from "./types.js";

const SUPPORTED_ENCODINGS = new Set<SupportedEncoding>(["utf-8", "shift_jis"]);
type Failure = { ok: false; code: string; message: string; path?: string };
type ValueResult<T> = { ok: true; value: T } | Failure;

export function validateAndNormalize(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail("validation_error", "request must be a JSON object");
  const unknown = unknownKeys(input, REQUEST_SHAPE);
  if (unknown) return fail("validation_error", `unknown request field: ${unknown}`, unknown);
  if (input.version !== VERSION) return fail("validation_error", "version must be 1", "version");
  if (typeof input.root !== "string" || input.root.length === 0) return fail("validation_error", "root is required", "root");
  if (!Array.isArray(input.files) || input.files.length === 0) return fail("validation_error", "files must be a non-empty array", "files");

  const encoding = validateEncoding(input.encoding);
  if (!encoding.ok) return encoding;
  const limits = validateLimits(input.limits);
  if (!limits.ok) return limits;
  if (input.files.length > limits.value.maxFiles) return fail("validation_error", "files exceeds maxFiles", "files");

  const files: EffectiveFileRequest[] = [];
  for (let index = 0; index < input.files.length; index += 1) {
    const file = validateFile(input.files[index], `files.${index}`);
    if (!file.ok) return file;
    files.push(file.value);
  }

  return {
    ok: true,
    effectiveRequest: {
      version: 1,
      root: input.root,
      files,
      encoding: encoding.value,
      limits: limits.value,
    },
  };
}

function validateFile(entry: unknown, fieldPath: string): ValueResult<EffectiveFileRequest> {
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

function validateEncoding(value: unknown): ValueResult<EffectiveRequest["encoding"]> {
  if (value === undefined) return { ok: true, value: { default: DEFAULTS.encoding.default, extensions: {} } };
  if (!isRecord(value)) return fail("validation_error", "encoding must be an object", "encoding");
  const unknown = unknownKeys(value, { default: true, extensions: true });
  if (unknown) return fail("validation_error", `unknown encoding field: ${unknown}`, `encoding.${unknown}`);

  const defaultEncoding = value.default === undefined ? DEFAULTS.encoding.default : value.default;
  if (!isSupportedEncoding(defaultEncoding)) return fail("validation_error", "unsupported default encoding", "encoding.default");

  const extensions: Record<string, SupportedEncoding> = {};
  if (value.extensions !== undefined) {
    if (!isRecord(value.extensions)) return fail("validation_error", "encoding.extensions must be an object", "encoding.extensions");
    for (const [extension, encoding] of Object.entries(value.extensions)) {
      if (!extension.startsWith(".") || extension.includes("/") || extension.includes("\\")) return fail("validation_error", "encoding extension keys must be exact extensions with leading dot", `encoding.extensions.${extension}`);
      if (!isSupportedEncoding(encoding)) return fail("validation_error", "unsupported extension encoding", `encoding.extensions.${extension}`);
      extensions[extension] = encoding;
    }
  }
  return { ok: true, value: { default: defaultEncoding, extensions } };
}

function validateLimits(value: unknown): ValueResult<EffectiveRequest["limits"]> {
  if (value === undefined) return { ok: true, value: { ...DEFAULTS.limits } };
  if (!isRecord(value)) return fail("validation_error", "limits must be an object", "limits");
  const unknown = unknownKeys(value, { maxFileBytes: true, maxFiles: true, maxTotalBytes: true });
  if (unknown) return fail("validation_error", `unknown limits field: ${unknown}`, `limits.${unknown}`);
  const maxFileBytes = value.maxFileBytes === undefined ? DEFAULTS.limits.maxFileBytes : value.maxFileBytes;
  const maxFiles = value.maxFiles === undefined ? DEFAULTS.limits.maxFiles : value.maxFiles;
  const maxTotalBytes = value.maxTotalBytes === undefined ? DEFAULTS.limits.maxTotalBytes : value.maxTotalBytes;
  if (!isIntegerInRange(maxFileBytes, 1, LIMITS.maxFileBytes)) return fail("validation_error", "limits.maxFileBytes is out of range", "limits.maxFileBytes");
  if (!isIntegerInRange(maxFiles, 1, LIMITS.maxFiles)) return fail("validation_error", "limits.maxFiles is out of range", "limits.maxFiles");
  if (!isIntegerInRange(maxTotalBytes, 1, LIMITS.maxTotalBytes)) return fail("validation_error", "limits.maxTotalBytes is out of range", "limits.maxTotalBytes");
  return { ok: true, value: { maxFileBytes, maxFiles, maxTotalBytes } };
}

function unknownKeys(value: Record<string, unknown>, shape: Record<string, true | Record<string, true>>): string | null {
  for (const key of Object.keys(value)) {
    if (!(key in shape)) return key;
  }
  return null;
}

function isSupportedEncoding(value: unknown): value is SupportedEncoding {
  return typeof value === "string" && SUPPORTED_ENCODINGS.has(value as SupportedEncoding);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: string, message: string, path?: string): Failure {
  return { ok: false, code, message, ...(path ? { path } : {}) };
}
