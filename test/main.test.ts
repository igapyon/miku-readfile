import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { main } from "../src/main.js";

class StringWritable extends Writable {
  value = "";

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.value += chunk.toString();
    callback();
  }
}

class ThrowingWritable extends Writable {
  override write(_chunk: unknown, _encoding?: BufferEncoding | ((error?: Error | null) => void), _callback?: (error?: Error | null) => void): boolean {
    throw new Error("stdout failure");
  }
}

function stdinFrom(text: string): Readable {
  return Readable.from([text]);
}

describe("main", () => {
  it("returns plain text for --help and --version", async () => {
    const helpOut = new StringWritable();
    const helpErr = new StringWritable();
    const helpCode = await main(["node", "miku-readfile", "--help"], stdinFrom(""), helpOut, helpErr);

    expect(helpCode).toBe(0);
    expect(helpOut.value).toContain("miku-readfile");
    expect(helpOut.value).toContain("Usage:");
    expect(helpOut.value).toContain("Range request example:");
    expect(helpOut.value).toContain("Safety:");
    expect(helpErr.value).toBe("");

    const versionOut = new StringWritable();
    const versionErr = new StringWritable();
    const versionCode = await main(["node", "miku-readfile", "--version"], stdinFrom(""), versionOut, versionErr);

    expect(versionCode).toBe(0);
    expect(versionOut.value).toMatch(/^miku-readfile /);
    expect(versionErr.value).toBe("");

    const shortHelpOut = new StringWritable();
    const shortHelpErr = new StringWritable();
    const shortHelpCode = await main(["node", "miku-readfile", "-h"], stdinFrom(""), shortHelpOut, shortHelpErr);

    expect(shortHelpCode).toBe(0);
    expect(shortHelpOut.value).toContain("miku-readfile -h");
    expect(shortHelpErr.value).toBe("");
  });

  it("returns exit code 2 for malformed stdin", async () => {
    const stdout = new StringWritable();
    const stderr = new StringWritable();
    const code = await main(["node", "miku-readfile"], stdinFrom("{"), stdout, stderr);

    expect(code).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("malformed stdin:");
  });

  it("returns JSON and exit code 1 for expected failures", async () => {
    const stdout = new StringWritable();
    const stderr = new StringWritable();
    const code = await main(["node", "miku-readfile"], stdinFrom(JSON.stringify({ version: 1, root: ".", files: [] })), stdout, stderr);

    expect(code).toBe(1);
    expect(stderr.value).toBe("");
    const result = JSON.parse(stdout.value) as { ok: boolean; diagnostics: Array<{ code: string }> };
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("validation_error");
  });

  it("returns exit code 3 for unexpected runtime errors", async () => {
    const stderr = new StringWritable();
    const code = await main(["node", "miku-readfile"], stdinFrom(JSON.stringify({ version: 1, root: ".", files: ["README.md"] })), new ThrowingWritable(), stderr);

    expect(code).toBe(3);
    expect(stderr.value).toContain("unexpected runtime error:");
    expect(stderr.value).toContain("stdout failure");
  });
});
