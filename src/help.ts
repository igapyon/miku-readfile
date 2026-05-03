export function helpText(): string {
  return `miku-readfile

Local-first structured file reader CLI for AI agents and automation.

Usage:
  miku-readfile < request.json > result.json
  miku-readfile --version
  miku-readfile --help
  miku-readfile -h

Primary contract:
  stdin   request JSON
  stdout  result JSON
  stderr  unexpected runtime-level messages only

Minimal request:
{
  "version": 1,
  "root": ".",
  "files": ["README.md"]
}

Encoding request example:
{
  "version": 1,
  "root": ".",
  "files": ["README.md", "src/Legacy.java"],
  "encoding": {
    "default": "utf-8",
    "extensions": {
      ".java": "shift_jis"
    }
  }
}

Range request example:
{
  "version": 1,
  "root": ".",
  "files": [
    {
      "path": "src/Legacy.java",
      "range": {
        "startLine": 120,
        "lineCount": 40
      }
    }
  ],
  "encoding": {
    "default": "utf-8",
    "extensions": {
      ".java": "shift_jis"
    }
  }
}

Result includes:
  files[]     decoded text and metadata
  summary     requestedFiles, filesRead, filesSkipped, diagnostics
  diagnostics structured expected failures

Default limits:
  maxFileBytes   10485760 bytes
  maxFiles       100
  maxTotalBytes  4194304 bytes

Safety:
  files must be request.root-relative paths using /
  absolute paths and .. path segments are validation errors
  filesystem root and user home are rejected as too broad
  directories, symlinks, binary files, decode errors, and oversized files are skipped

Exit codes:
  0  ok: true
  1  ok: false expected failure
  2  malformed stdin or invalid CLI usage
  3  unexpected runtime error
`;
}
