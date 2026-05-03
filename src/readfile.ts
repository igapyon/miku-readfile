import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { decode, selectEncoding } from "./encoding.js";
import { isPathInsideOrSame, toJsonPath } from "./path-security.js";
import { finish, validationFailure } from "./result.js";
import { rangeText, shapeText } from "./text-shape.js";
import { validateAndNormalize } from "./validation.js";
import type { Diagnostic, EffectiveFileRequest, EffectiveRequest, FileResult, MikuReadfileResult } from "./types.js";

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
      return finish([], [{
        severity: "error",
        code: "max_total_bytes_exceeded",
        message: "total filesystem bytes exceeded maxTotalBytes",
        skipped: true,
        details: { maxTotalBytes: request.limits.maxTotalBytes },
      }], request.files.length, false);
    }
    results.push(readResult.file);
  }

  return finish(results, diagnostics, request.files.length);
}

async function readOne(request: EffectiveRequest, rootRealPath: string, file: EffectiveFileRequest): Promise<{ ok: true; file: FileResult } | { ok: false; diagnostic: Diagnostic }> {
  const absolutePath = path.join(rootRealPath, ...file.path.split("/"));
  let lstat;
  try {
    lstat = await fs.lstat(absolutePath);
  } catch {
    return fileError("file_not_readable", "file could not be read", file.path);
  }
  if (lstat.isSymbolicLink()) return fileError("symlink_skipped", "symlink was skipped", file.path);

  let realPath;
  try {
    realPath = await fs.realpath(absolutePath);
  } catch {
    return fileError("file_not_readable", "file could not be resolved", file.path);
  }
  if (!isPathInsideOrSame(realPath, rootRealPath)) return fileError("path_escape_skipped", "path resolved outside root and was skipped", file.path);

  let stat;
  try {
    stat = await fs.stat(realPath);
  } catch {
    return fileError("file_not_readable", "file could not be read", file.path);
  }
  if (!stat.isFile()) return fileError("not_file", "path is not a regular file", file.path);
  if (stat.size > request.limits.maxFileBytes) {
    return fileError("max_file_bytes_exceeded", "file exceeded maxFileBytes and was skipped", file.path, { size: stat.size, maxFileBytes: request.limits.maxFileBytes });
  }

  let bytes;
  try {
    await fs.access(realPath, fsConstants.R_OK);
    bytes = await fs.readFile(realPath);
  } catch {
    return fileError("file_not_readable", "file could not be read", file.path);
  }
  if (bytes.includes(0)) return fileError("binary_file_skipped", "binary file was skipped", file.path);

  const encoding = selectEncoding(request, file);
  let decoded;
  try {
    decoded = decode(bytes, encoding);
  } catch {
    return fileError("decode_error", "file could not be decoded", file.path);
  }

  const shaped = shapeText(decoded, encoding, hasUtf8Bom(bytes));
  const effectiveRange = file.range ? rangeText(shaped, file.range.startLine, file.range.lineCount) : null;
  return {
    ok: true,
    file: {
      file: toJsonPath(file.path),
      encoding,
      bom: shaped.bom,
      lineEnding: shaped.lineEnding,
      finalNewline: shaped.finalNewline,
      bytes: stat.size,
      lines: shaped.logicalLineCount,
      modifiedTime: stat.mtime.toISOString(),
      range: file.range && effectiveRange ? {
        startLine: file.range.startLine,
        lineCount: effectiveRange.lineCount,
        endLine: effectiveRange.endLine,
        eof: effectiveRange.eof,
      } : null,
      text: effectiveRange ? effectiveRange.text : shaped.text,
    },
  };
}

async function checkRoot(rootPath: string, requestRoot: string): Promise<{ ok: true; realPath: string } | { ok: false; diagnostic: Diagnostic }> {
  let realPath;
  try {
    const stat = await fs.stat(rootPath);
    if (!stat.isDirectory()) return rootError("root_not_accessible", "root is not a directory", requestRoot);
    await fs.access(rootPath, fsConstants.R_OK);
    realPath = await fs.realpath(rootPath);
  } catch (error) {
    const code = isNodeError(error) && error.code === "ENOENT" ? "root_not_found" : "root_not_accessible";
    return rootError(code, code === "root_not_found" ? "root does not exist" : "root is not accessible", requestRoot);
  }
  if (path.parse(realPath).root === realPath || realPath === path.resolve(os.homedir())) {
    return rootError("root_too_broad", "root is too broad", requestRoot);
  }
  return { ok: true, realPath };
}

function rootError(code: string, message: string, pathValue: string): { ok: false; diagnostic: Diagnostic } {
  return { ok: false, diagnostic: { severity: "error", code, message, path: pathValue } };
}

function fileError(code: string, message: string, file: string, details?: Record<string, unknown>): { ok: false; diagnostic: Diagnostic } {
  return { ok: false, diagnostic: { severity: "error", code, message, file, skipped: true, ...(details ? { details } : {}) } };
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
