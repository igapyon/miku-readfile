import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { rootError } from "./diagnostics.js";
import type { Diagnostic } from "./types.js";

export async function checkRoot(rootPath: string, requestRoot: string): Promise<{ ok: true; realPath: string } | { ok: false; diagnostic: Diagnostic }> {
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
