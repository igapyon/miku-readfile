import { DEFAULTS } from "./constants.js";
import { fail, isRecord, isSupportedEncoding, unknownKeys } from "./validation-common.js";
import type { EffectiveRequest, SupportedEncoding } from "./types.js";
import type { ValueResult } from "./validation-common.js";

export function validateEncoding(value: unknown): ValueResult<EffectiveRequest["encoding"]> {
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
