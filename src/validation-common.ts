import type { SupportedEncoding } from "./types.js";

const SUPPORTED_ENCODINGS = new Set<SupportedEncoding>(["utf-8", "shift_jis"]);

export type Failure = { ok: false; code: string; message: string; path?: string };
export type ValueResult<T> = { ok: true; value: T } | Failure;

export function unknownKeys(value: Record<string, unknown>, shape: Record<string, true | Record<string, true>>): string | null {
  for (const key of Object.keys(value)) {
    if (!(key in shape)) return key;
  }
  return null;
}

export function isSupportedEncoding(value: unknown): value is SupportedEncoding {
  return typeof value === "string" && SUPPORTED_ENCODINGS.has(value as SupportedEncoding);
}

export function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1;
}

export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= min && value <= max;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fail(code: string, message: string, path?: string): Failure {
  return { ok: false, code, message, ...(path ? { path } : {}) };
}
