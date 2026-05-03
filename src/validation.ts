import { REQUEST_SHAPE, VERSION } from "./constants.js";
import { validateEncoding } from "./validate-encoding.js";
import { validateFile } from "./validate-file.js";
import { validateLimits } from "./validate-limits.js";
import { fail, isRecord, unknownKeys } from "./validation-common.js";
import type { EffectiveFileRequest, ValidationResult } from "./types.js";

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
