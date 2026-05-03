import type { Diagnostic } from "./types.js";

export function rootError(code: string, message: string, pathValue: string): { ok: false; diagnostic: Diagnostic } {
  return { ok: false, diagnostic: { severity: "error", code, message, path: pathValue } };
}

export function fileError(code: string, message: string, file: string, details?: Record<string, unknown>): { ok: false; diagnostic: Diagnostic } {
  return { ok: false, diagnostic: { severity: "error", code, message, file, skipped: true, ...(details ? { details } : {}) } };
}

export function maxTotalBytesExceeded(maxTotalBytes: number): Diagnostic {
  return {
    severity: "error",
    code: "max_total_bytes_exceeded",
    message: "total filesystem bytes exceeded maxTotalBytes",
    skipped: true,
    details: { maxTotalBytes },
  };
}
