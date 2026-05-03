import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileError } from "./diagnostics.js";
import { decode, selectEncoding } from "./encoding.js";
import { createFileResult } from "./file-result.js";
import { isPathInsideOrSame } from "./path-security.js";
import type { Diagnostic, EffectiveFileRequest, EffectiveRequest, FileResult } from "./types.js";

export async function readOne(request: EffectiveRequest, rootRealPath: string, file: EffectiveFileRequest): Promise<{ ok: true; file: FileResult } | { ok: false; diagnostic: Diagnostic }> {
  const candidate = await resolveReadableFile(request, rootRealPath, file);
  if (!candidate.ok) return candidate;

  const bytes = await readBytes(candidate.realPath, file.path);
  if (!bytes.ok) return bytes;
  if (bytes.bytes.includes(0)) return fileError("binary_file_skipped", "binary file was skipped", file.path);

  const encoding = selectEncoding(request, file);
  let decoded;
  try {
    decoded = decode(bytes.bytes, encoding);
  } catch {
    return fileError("decode_error", "file could not be decoded", file.path);
  }

  return {
    ok: true,
    file: createFileResult({
      file,
      encoding,
      decoded,
      utf8BomPresent: hasUtf8Bom(bytes.bytes),
      bytes: candidate.size,
      modifiedTime: candidate.modifiedTime,
    }),
  };
}

async function resolveReadableFile(request: EffectiveRequest, rootRealPath: string, file: EffectiveFileRequest): Promise<{ ok: true; realPath: string; size: number; modifiedTime: string } | { ok: false; diagnostic: Diagnostic }> {
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

  return { ok: true, realPath, size: stat.size, modifiedTime: stat.mtime.toISOString() };
}

async function readBytes(realPath: string, filePath: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; diagnostic: Diagnostic }> {
  try {
    await fs.access(realPath, fsConstants.R_OK);
    return { ok: true, bytes: await fs.readFile(realPath) };
  } catch {
    return fileError("file_not_readable", "file could not be read", filePath);
  }
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}
