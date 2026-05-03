import type { Diagnostic, FileResult, MikuReadfileResult, Summary } from "./types.js";

export function createSummary(requestedFiles = 0): Summary {
  return { requestedFiles, filesRead: 0, filesSkipped: 0, diagnostics: 0 };
}

export function finish(files: FileResult[], diagnostics: Diagnostic[], requestedFiles: number, forcedOk?: false): MikuReadfileResult {
  const filesSkipped = Math.max(0, requestedFiles - files.length);
  const summary = {
    requestedFiles,
    filesRead: files.length,
    filesSkipped,
    diagnostics: diagnostics.length,
  };
  return {
    version: 1,
    ok: forcedOk === false ? false : filesSkipped === 0 && diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    files,
    summary,
    diagnostics,
  };
}

export function validationFailure(code: string, message: string, path?: string): MikuReadfileResult {
  const diagnostics: Diagnostic[] = [{ severity: "error", code, message, ...(path ? { path } : {}) }];
  return {
    version: 1,
    ok: false,
    files: [],
    summary: { ...createSummary(0), diagnostics: diagnostics.length },
    diagnostics,
  };
}
