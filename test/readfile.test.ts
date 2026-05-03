import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import iconv from "iconv-lite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runRequest } from "../src/readfile.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "miku-readfile-test-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("runRequest", () => {
  it("reads a minimal UTF-8 request", async () => {
    await fs.writeFile(path.join(tempDir, "README.md"), "hello\n", "utf8");

    const result = await runRequest({ version: 1, root: tempDir, files: ["README.md"] });

    expect(result.ok).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      file: "README.md",
      encoding: "utf-8",
      bom: null,
      lineEnding: "lf",
      finalNewline: true,
      lines: 1,
      range: null,
      text: "hello\n",
    });
    expect(result.summary).toMatchObject({ requestedFiles: 1, filesRead: 1, filesSkipped: 0, diagnostics: 0 });
  });

  it("uses extension encoding rules for Shift_JIS files", async () => {
    await fs.mkdir(path.join(tempDir, "src"));
    await fs.writeFile(path.join(tempDir, "src", "Legacy.java"), iconv.encode("こんにちは\n", "shift_jis"));

    const result = await runRequest({
      version: 1,
      root: tempDir,
      files: ["src/Legacy.java"],
      encoding: { default: "utf-8", extensions: { ".java": "shift_jis" } },
    });

    expect(result.ok).toBe(true);
    expect(result.files[0]?.encoding).toBe("shift_jis");
    expect(result.files[0]?.text).toBe("こんにちは\n");
  });

  it("allows per-file encoding override to take precedence", async () => {
    await fs.writeFile(path.join(tempDir, "memo.md"), iconv.encode("メモ\n", "shift_jis"));

    const result = await runRequest({
      version: 1,
      root: tempDir,
      files: [{ path: "memo.md", encoding: "shift_jis" }],
      encoding: { default: "utf-8", extensions: { ".md": "utf-8" } },
    });

    expect(result.ok).toBe(true);
    expect(result.files[0]?.encoding).toBe("shift_jis");
    expect(result.files[0]?.text).toBe("メモ\n");
  });

  it("returns range metadata and empty text after EOF", async () => {
    await fs.writeFile(path.join(tempDir, "notes.txt"), "a\r\nb\r\n", "utf8");

    const rangeResult = await runRequest({
      version: 1,
      root: tempDir,
      files: [{ path: "notes.txt", range: { startLine: 2, lineCount: 4 } }],
    });

    expect(rangeResult.ok).toBe(true);
    expect(rangeResult.files[0]?.text).toBe("b\n");
    expect(rangeResult.files[0]?.range).toEqual({ startLine: 2, lineCount: 1, endLine: 2, eof: true });

    const eofResult = await runRequest({
      version: 1,
      root: tempDir,
      files: [{ path: "notes.txt", range: { startLine: 9, lineCount: 2 } }],
    });

    expect(eofResult.ok).toBe(true);
    expect(eofResult.files[0]?.text).toBe("");
    expect(eofResult.files[0]?.range).toEqual({ startLine: 9, lineCount: 0, endLine: null, eof: true });
  });

  it("rejects absolute and parent paths during validation", async () => {
    const absoluteResult = await runRequest({ version: 1, root: tempDir, files: [path.join(tempDir, "README.md")] });
    expect(absoluteResult.ok).toBe(false);
    expect(absoluteResult.diagnostics[0]?.code).toBe("validation_error");

    const parentResult = await runRequest({ version: 1, root: tempDir, files: ["../README.md"] });
    expect(parentResult.ok).toBe(false);
    expect(parentResult.diagnostics[0]?.code).toBe("validation_error");
  });

  it("marks a directory request as skipped and ok false", async () => {
    await fs.mkdir(path.join(tempDir, "src"));

    const result = await runRequest({ version: 1, root: tempDir, files: ["src"] });

    expect(result.ok).toBe(false);
    expect(result.files).toHaveLength(0);
    expect(result.summary).toMatchObject({ requestedFiles: 1, filesRead: 0, filesSkipped: 1, diagnostics: 1 });
    expect(result.diagnostics[0]).toMatchObject({ code: "not_file", file: "src", skipped: true });
  });

  it("returns decode_error for invalid UTF-8", async () => {
    await fs.writeFile(path.join(tempDir, "broken.txt"), Buffer.from([0x80]));

    const result = await runRequest({ version: 1, root: tempDir, files: ["broken.txt"] });

    expect(result.ok).toBe(false);
    expect(result.files).toHaveLength(0);
    expect(result.diagnostics[0]).toMatchObject({ code: "decode_error", file: "broken.txt", skipped: true });
  });

  it("skips binary files", async () => {
    await fs.writeFile(path.join(tempDir, "binary.dat"), Buffer.from([0x61, 0x00, 0x62]));

    const result = await runRequest({ version: 1, root: tempDir, files: ["binary.dat"] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "binary_file_skipped", file: "binary.dat", skipped: true });
  });

  it("skips symlinks", async () => {
    await fs.writeFile(path.join(tempDir, "target.txt"), "target\n", "utf8");
    await fs.symlink(path.join(tempDir, "target.txt"), path.join(tempDir, "link.txt"));

    const result = await runRequest({ version: 1, root: tempDir, files: ["link.txt"] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "symlink_skipped", file: "link.txt", skipped: true });
  });

  it("rejects user home as root too broad", async () => {
    const result = await runRequest({ version: 1, root: os.homedir(), files: ["README.md"] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "root_too_broad", path: os.homedir() });
  });

  it("handles BOM, empty files, final newline, and mixed line endings", async () => {
    await fs.writeFile(path.join(tempDir, "bom.txt"), "\uFEFFhello", "utf8");
    await fs.writeFile(path.join(tempDir, "empty.txt"), "", "utf8");
    await fs.writeFile(path.join(tempDir, "mixed.txt"), "a\r\nb\nc\rd", "utf8");

    const result = await runRequest({ version: 1, root: tempDir, files: ["bom.txt", "empty.txt", "mixed.txt"] });

    expect(result.ok).toBe(true);
    expect(result.files[0]).toMatchObject({ file: "bom.txt", bom: "utf-8", text: "hello", finalNewline: false });
    expect(result.files[1]).toMatchObject({ file: "empty.txt", text: "", lines: 0, lineEnding: "none", finalNewline: false });
    expect(result.files[2]).toMatchObject({ file: "mixed.txt", text: "a\nb\nc\nd", lineEnding: "mixed", finalNewline: false, lines: 4 });
  });

  it("does not add artificial trailing newline to range output", async () => {
    await fs.writeFile(path.join(tempDir, "plain.txt"), "a\nb\nc", "utf8");

    const result = await runRequest({
      version: 1,
      root: tempDir,
      files: [{ path: "plain.txt", range: { startLine: 3, lineCount: 1 } }],
    });

    expect(result.ok).toBe(true);
    expect(result.files[0]?.text).toBe("c");
    expect(result.files[0]?.finalNewline).toBe(false);
  });

  it("enforces file and total byte limits", async () => {
    await fs.writeFile(path.join(tempDir, "a.txt"), "aaa", "utf8");
    await fs.writeFile(path.join(tempDir, "b.txt"), "bbb", "utf8");

    const fileLimit = await runRequest({
      version: 1,
      root: tempDir,
      files: ["a.txt"],
      limits: { maxFileBytes: 2 },
    });
    expect(fileLimit.ok).toBe(false);
    expect(fileLimit.diagnostics[0]).toMatchObject({ code: "max_file_bytes_exceeded", file: "a.txt", skipped: true });

    const totalLimit = await runRequest({
      version: 1,
      root: tempDir,
      files: ["a.txt", "b.txt"],
      limits: { maxTotalBytes: 5 },
    });
    expect(totalLimit.ok).toBe(false);
    expect(totalLimit.files).toHaveLength(0);
    expect(totalLimit.diagnostics[0]).toMatchObject({ code: "max_total_bytes_exceeded", skipped: true });
  });

  it("rejects maxFiles overflow", async () => {
    const result = await runRequest({ version: 1, root: tempDir, files: ["a.txt", "b.txt"], limits: { maxFiles: 1 } });

    expect(result.ok).toBe(false);
    expect(result.summary.requestedFiles).toBe(0);
    expect(result.diagnostics[0]).toMatchObject({ code: "validation_error", path: "files" });
  });

  it("rejects invalid request shapes", async () => {
    const unknown = await runRequest({ version: 1, root: tempDir, files: ["README.md"], extra: true });
    expect(unknown.ok).toBe(false);
    expect(unknown.summary.requestedFiles).toBe(0);
    expect(unknown.diagnostics[0]).toMatchObject({ code: "validation_error", path: "extra" });

    const invalidRange = await runRequest({ version: 1, root: tempDir, files: [{ path: "README.md", range: { startLine: 1, lineCount: 0 } }] });
    expect(invalidRange.ok).toBe(false);
    expect(invalidRange.diagnostics[0]).toMatchObject({ code: "validation_error", path: "files.0.range.lineCount" });

    const invalidExtension = await runRequest({ version: 1, root: tempDir, files: ["README.md"], encoding: { extensions: { java: "shift_jis" } } });
    expect(invalidExtension.ok).toBe(false);
    expect(invalidExtension.diagnostics[0]).toMatchObject({ code: "validation_error", path: "encoding.extensions.java" });

    const invalidType = await runRequest({ version: 1, root: tempDir, files: [123] });
    expect(invalidType.ok).toBe(false);
    expect(invalidType.diagnostics[0]).toMatchObject({ code: "validation_error", path: "files.0" });

    const invalidEnum = await runRequest({ version: 1, root: tempDir, files: ["README.md"], encoding: { default: "latin1" } });
    expect(invalidEnum.ok).toBe(false);
    expect(invalidEnum.diagnostics[0]).toMatchObject({ code: "validation_error", path: "encoding.default" });
  });

  it("detects CR-only line endings", async () => {
    await fs.writeFile(path.join(tempDir, "classic.txt"), "a\rb\r", "utf8");

    const result = await runRequest({ version: 1, root: tempDir, files: ["classic.txt"] });

    expect(result.ok).toBe(true);
    expect(result.files[0]).toMatchObject({ lineEnding: "cr", finalNewline: true, lines: 2, text: "a\nb\n" });
  });

  it("preserves whole-file text without final newline", async () => {
    await fs.writeFile(path.join(tempDir, "nofinal.txt"), "no final", "utf8");

    const result = await runRequest({ version: 1, root: tempDir, files: ["nofinal.txt"] });

    expect(result.ok).toBe(true);
    expect(result.files[0]).toMatchObject({ finalNewline: false, lineEnding: "none", lines: 1, text: "no final" });
  });

  it("rejects filesystem root as too broad", async () => {
    const root = path.parse(tempDir).root;
    const result = await runRequest({ version: 1, root, files: ["README.md"] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "root_too_broad", path: root });
  });

  it("does not deduplicate duplicate request entries or diagnostics", async () => {
    await fs.writeFile(path.join(tempDir, "same.txt"), "one\ntwo\n", "utf8");

    const duplicateReads = await runRequest({
      version: 1,
      root: tempDir,
      files: [
        { path: "same.txt", range: { startLine: 1, lineCount: 1 } },
        { path: "same.txt", range: { startLine: 2, lineCount: 1 } },
      ],
    });
    expect(duplicateReads.ok).toBe(true);
    expect(duplicateReads.files.map((file) => file.text)).toEqual(["one\n", "two\n"]);

    const duplicateFailures = await runRequest({ version: 1, root: tempDir, files: ["missing.txt", "missing.txt"] });
    expect(duplicateFailures.ok).toBe(false);
    expect(duplicateFailures.diagnostics).toHaveLength(2);
    expect(duplicateFailures.summary).toMatchObject({ requestedFiles: 2, filesRead: 0, filesSkipped: 2, diagnostics: 2 });
  });

  it("returns read files plus ok false for partial failure", async () => {
    await fs.writeFile(path.join(tempDir, "ok.txt"), "ok\n", "utf8");

    const result = await runRequest({ version: 1, root: tempDir, files: ["ok.txt", "missing.txt"] });

    expect(result.ok).toBe(false);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.file).toBe("ok.txt");
    expect(result.summary).toMatchObject({ requestedFiles: 2, filesRead: 1, filesSkipped: 1, diagnostics: 1 });
  });

  it("returns a diagnostic for unreadable files where the platform permits it", async () => {
    if (process.platform === "win32" || (typeof process.getuid === "function" && process.getuid() === 0)) return;
    const unreadablePath = path.join(tempDir, "unreadable.txt");
    await fs.writeFile(unreadablePath, "secret\n", "utf8");
    await fs.chmod(unreadablePath, 0o000);

    try {
      const result = await runRequest({ version: 1, root: tempDir, files: ["unreadable.txt"] });

      expect(result.ok).toBe(false);
      expect(result.files).toHaveLength(0);
      expect(result.diagnostics[0]).toMatchObject({ code: "file_not_readable", file: "unreadable.txt", skipped: true });
    } finally {
      await fs.chmod(unreadablePath, 0o600);
    }
  });
});
