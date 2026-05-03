#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

const versionResult = spawnSync(process.execPath, ["bundle/miku-readfile.mjs", "--version"], {
  encoding: "utf8",
});

if (versionResult.status !== 0 || !versionResult.stdout.startsWith("miku-readfile ")) {
  process.stderr.write(versionResult.stderr || versionResult.stdout || "bundle --version smoke failed\n");
  process.exit(1);
}

const helpResult = spawnSync(process.execPath, ["bundle/miku-readfile.mjs", "--help"], {
  encoding: "utf8",
});
if (
  helpResult.status !== 0 ||
  !helpResult.stdout.includes("Primary contract:") ||
  !helpResult.stdout.includes("Range request example:")
) {
  process.stderr.write(helpResult.stderr || helpResult.stdout || "bundle --help smoke failed\n");
  process.exit(1);
}

const request = {
  version: 1,
  root: ".",
  files: ["README.md"],
};
const stdioResult = await runWithInput(process.execPath, ["bundle/miku-readfile.mjs"], `${JSON.stringify(request)}\n`);

if (stdioResult.code !== 0) {
  process.stderr.write(stdioResult.stderr || stdioResult.stdout || "bundle stdio smoke failed\n");
  process.exit(1);
}

const parsed = JSON.parse(stdioResult.stdout);
if (parsed.version !== 1 || parsed.ok !== true || !Array.isArray(parsed.files) || parsed.files[0]?.file !== "README.md") {
  process.stderr.write("bundle stdio smoke returned unexpected JSON\n");
  process.exit(1);
}

const archiveResult = spawnSync("tar", ["-tzf", "bundle/miku-readfile-sources.tgz"], {
  encoding: "utf8",
});
if (archiveResult.status !== 0) {
  process.stderr.write(archiveResult.stderr || "source archive smoke failed\n");
  process.exit(1);
}
const archiveEntries = new Set(archiveResult.stdout.trim().split("\n"));
for (const entry of [
  "package.json",
  "src/main.ts",
  "src/readfile.ts",
  "src/types.ts",
  "test/main.test.ts",
  "test/readfile.test.ts",
  "scripts/build-cli-bundle.mjs",
]) {
  if (!archiveEntries.has(entry)) {
    process.stderr.write(`source archive missing ${entry}\n`);
    process.exit(1);
  }
}

process.stdout.write(versionResult.stdout);

function runWithInput(command, args, input) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
