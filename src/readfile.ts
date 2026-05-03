import path from "node:path";
import { maxTotalBytesExceeded } from "./diagnostics.js";
import { readOne } from "./file-reader.js";
import { finish, validationFailure } from "./result.js";
import { checkRoot } from "./root.js";
import { validateAndNormalize } from "./validation.js";
import type { Diagnostic, EffectiveRequest, FileResult, MikuReadfileResult } from "./types.js";

export async function runRequest(request: unknown, cwd = process.cwd()): Promise<MikuReadfileResult> {
  const validation = validateAndNormalize(request);
  if (!validation.ok) return validationFailure(validation.code, validation.message, validation.path);

  const effectiveRequest = validation.effectiveRequest;
  const rootCheck = await checkRoot(path.resolve(cwd, effectiveRequest.root), effectiveRequest.root);
  if (!rootCheck.ok) return finish([], [rootCheck.diagnostic], effectiveRequest.files.length, false);

  return readFiles(effectiveRequest, rootCheck.realPath);
}

async function readFiles(request: EffectiveRequest, rootRealPath: string): Promise<MikuReadfileResult> {
  const diagnostics: Diagnostic[] = [];
  const results: FileResult[] = [];
  let totalBytes = 0;

  for (const file of request.files) {
    const readResult = await readOne(request, rootRealPath, file);
    if (!readResult.ok) {
      diagnostics.push(readResult.diagnostic);
      continue;
    }
    totalBytes += readResult.file.bytes;
    if (totalBytes > request.limits.maxTotalBytes) {
      return finish([], [maxTotalBytesExceeded(request.limits.maxTotalBytes)], request.files.length, false);
    }
    results.push(readResult.file);
  }

  return finish(results, diagnostics, request.files.length);
}
