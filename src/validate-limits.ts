import { DEFAULTS, LIMITS } from "./constants.js";
import { fail, isIntegerInRange, isRecord, unknownKeys } from "./validation-common.js";
import type { EffectiveRequest } from "./types.js";
import type { ValueResult } from "./validation-common.js";

export function validateLimits(value: unknown): ValueResult<EffectiveRequest["limits"]> {
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
