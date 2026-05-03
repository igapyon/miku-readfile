#!/usr/bin/env node

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { helpText } from "./help.js";
import { runRequest } from "./readfile.js";

export { helpText } from "./help.js";
export { runRequest } from "./readfile.js";

export type {
  Diagnostic,
  EffectiveRequest,
  FileRequestEntry,
  FileResult,
  LineEnding,
  MikuReadfileRequest,
  MikuReadfileResult,
  RangeRequest,
  RangeResult,
  Summary,
  SupportedEncoding,
} from "./types.js";

export async function main(argv = process.argv, stdin = process.stdin, stdout = process.stdout, stderr = process.stderr): Promise<number> {
  try {
    if (argv.length === 3 && argv[2] === "--version") {
      stdout.write(`miku-readfile ${await packageVersion()}\n`);
      return 0;
    }
    if (argv.length === 3 && (argv[2] === "--help" || argv[2] === "-h")) {
      stdout.write(helpText());
      return 0;
    }
    if (argv.length === 3 && argv[2]?.startsWith("-")) {
      stderr.write("usage: miku-readfile [--version|--help]\n");
      return 2;
    }
    if (argv.length > 2) {
      stderr.write("usage: miku-readfile [--version|--help]\n");
      return 2;
    }

    let request: unknown;
    try {
      request = JSON.parse(await readStdin(stdin));
    } catch (error) {
      stderr.write(`malformed stdin: ${error instanceof Error ? error.message : String(error)}\n`);
      return 2;
    }

    const result = await runRequest(request);
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    stderr.write(`unexpected runtime error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    return 3;
  }
}

async function readStdin(stdin: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}

async function packageVersion(): Promise<string> {
  const bundledVersion = (globalThis as typeof globalThis & { __MIKU_READFILE_BUNDLED_PACKAGE_VERSION__?: string }).__MIKU_READFILE_BUNDLED_PACKAGE_VERSION__;
  if (bundledVersion) return bundledVersion;
  try {
    const pkg = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  !(globalThis as typeof globalThis & { __MIKU_READFILE_BUNDLE_ENTRY__?: boolean }).__MIKU_READFILE_BUNDLE_ENTRY__
) {
  process.exitCode = await main();
}
