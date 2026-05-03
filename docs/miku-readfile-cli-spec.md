# miku-readfile CLI Specification Draft

## Purpose

`miku-readfile` is a small local-first CLI that reads explicitly specified text
files and returns decoded content as JSON for generative AI agents and
automation.

The tool exists mainly as a temporary workaround for AI tools that cannot
reliably read Shift_JIS files in local workspaces. If generative AI tools later
handle Shift_JIS files well enough by themselves, this tool may no longer be
needed.

`miku-readfile` intentionally does only one thing: read selected files. It does
not search for files. Use `miku-grep` to find files, then use `miku-readfile`
to read selected files.

## Design Principles

- Keep the tool small and simple.
- Read only explicitly specified regular files.
- Provide confidence by not having extra capabilities.
- Use JSON for both request and result.
- Decode text as UTF-8 or Shift_JIS.
- Return readable diagnostics instead of silently returning mojibake.
- Avoid MCP, GUI, server, daemon, and editor integration.
- Avoid features that duplicate `miku-grep`.
- Avoid features that make the tool feel like an agent, crawler, or editor.

## Scope

MVP scope:

- Node CLI
- stdin JSON request
- stdout JSON result
- `--version`
- `--help`
- explicit root-relative file paths
- UTF-8 decode
- Shift_JIS decode
- default encoding, extension encoding rules, and per-file encoding override
- whole-file read by default
- line range read with start line and line count
- output whether a range read reached EOF
- output effective encoding for each file
- output file metadata for each file
- output BOM handling metadata for each file
- normalize returned text line endings to LF
- output original line ending metadata for each file
- output whether the original file ended with a final newline
- output total logical line count for each file
- output a small result summary
- root boundary check
- file size limit
- file count limit
- total filesystem byte limit
- binary file skip
- decode error diagnostics

Out of scope:

- search
- regex
- glob expansion
- directory traversal
- ignore files
- secret policy or secret scanning
- MCP
- GUI
- VS Code extension
- web app
- server or daemon
- watch mode
- semantic chunking
- summary generation beyond the small result counts
- file conversion or overwrite
- encoding auto detection
- line-number-prefixed text output
- complex policy system

## CLI Contract

The CLI uses stdin and stdout as its primary interface.

```text
stdin
  request JSON

stdout
  result JSON

stderr
  unexpected runtime-level messages only
```

stdout must not contain progress logs, debug logs, or human-readable messages
mixed with JSON.

Expected failures should be returned as result JSON whenever possible.

Decoded text should be serialized with `JSON.stringify` or an equivalent JSON
serializer. The implementation should not build JSON output by manual string
concatenation.

`--version` and `--help` are exceptions to the stdin JSON contract. These two
commands may return plain text to stdout, matching the `miku-grep` convention.

```bash
miku-readfile --version
miku-readfile --help
```

## Exit Codes

Exit codes should match the `miku-grep` convention.

```text
0
  ok: true

1
  ok: false
  request JSON was parsed, but validation, unsafe request, read failure, decode
  failure, or another expected failure occurred

2
  malformed stdin or invalid CLI usage

3
  unexpected runtime error
```

For exit code `1`, stdout should contain `ok: false` result JSON whenever
possible.

For exit code `2` or `3`, stdout JSON may not be available. Callers should treat
the exit code as authoritative.

## Request JSON

Minimal request:

```json
{
  "version": 1,
  "root": ".",
  "files": ["README.md"]
}
```

Fuller example:

```json
{
  "version": 1,
  "root": ".",
  "files": [
    "README.md",
    {
      "path": "src/Legacy.java",
      "range": {
        "startLine": 120,
        "lineCount": 40
      }
    },
    {
      "path": "notes/old-memo.md",
      "encoding": "shift_jis"
    }
  ],
  "encoding": {
    "default": "utf-8",
    "extensions": {
      ".java": "shift_jis"
    }
  },
  "limits": {
    "maxFileBytes": 10485760,
    "maxFiles": 100,
    "maxTotalBytes": 4194304
  }
}
```

Top-level fields:

- `version`: request schema version. MVP uses `1`.
- `root`: required base directory for file reads. Use `"."` explicitly when the
  current working directory should be used.
- `files`: root-relative file entries to read.
- `encoding`: optional encoding selection object.
- `limits`: optional resource limits.

`encoding` and `limits` are optional. Defaults are applied when they are
omitted.

## File Entries

`files` entries may be strings or objects.

String form reads the whole file:

```json
"README.md"
```

Object form is used for range reads or per-file encoding override:

```json
{
  "path": "src/Legacy.java",
  "range": {
    "startLine": 120,
    "lineCount": 40
  },
  "encoding": "shift_jis"
}
```

File entry fields:

- `path`: root-relative file path.
- `range.startLine`: 1-based start line.
- `range.lineCount`: number of lines requested.
- `encoding`: optional per-file encoding override.

Per-file `encoding` overrides extension encoding and default encoding only for
that file.

Duplicate file requests must not be deduplicated. The same file may be requested
multiple times with different ranges, and results should follow the request
order as given.

## Request Validation

Request JSON should be validated strictly.

Validation rules:

- unknown request fields are validation errors
- invalid field types are validation errors
- invalid enum values are validation errors
- `version` must be `1`
- `root` is required
- file paths must be root-relative paths
- request and result file paths must use `/` as the path separator
- absolute file paths in `files` are validation errors
- file paths containing `..` path segments are validation errors
- `range.startLine` must be an integer greater than or equal to `1`
- request `range.lineCount` must be an integer greater than or equal to `1`

The tool should not provide an implicit default root. Callers that want to use
the current working directory should pass `"root": "."` explicitly.

Validation failures after request JSON is parsed should return `ok: false`
result JSON when possible.

```json
{
  "version": 1,
  "ok": false,
  "files": [],
  "summary": {
    "requestedFiles": 0,
    "filesRead": 0,
    "filesSkipped": 0,
    "diagnostics": 1
  },
  "diagnostics": [
    {
      "severity": "error",
      "code": "validation_error",
      "message": "request validation failed"
    }
  ]
}
```

Malformed stdin is an exit code `2` case, and stdout JSON may not be available.

For request-level validation failures, `summary.requestedFiles` should be `0`
because the request is not valid. Count file entries only after validation has
reached file-level processing.

## File Paths

`miku-readfile` reads regular files only.

Requested file paths must be relative paths from `request.root`.

Request and result file paths must use `/` as the path separator on every
platform, including Windows.

Absolute file paths in `files` are validation errors.

File paths containing `..` path segments are validation errors.

If a requested path resolves to a directory, the tool should not traverse it.
The directory entry should be skipped, and the overall result should be
`ok: false` with a diagnostic such as `not_file`.

Hidden files such as `.env` are not automatically blocked in MVP. Because this
tool reads only explicitly requested files, a hidden file may be read when it is
specified directly and passes the normal safety checks. Generative AI agents
should be careful about user intent before requesting secret-looking files.

Result file paths must be root-relative paths. Absolute local paths should not
be returned in result JSON.

## Root Validation

`request.root` must resolve to an existing readable directory.

The filesystem root directory is rejected as too broad. The current user's home
directory is also rejected as too broad in MVP, because it is usually wider than
the intended workspace boundary for an AI-agent file-read request.

When `root` cannot be accessed, the result should be `ok: false` with a
request-level diagnostic such as `root_not_found`, `root_not_accessible`, or
`root_too_broad`.

## Encoding

MVP supported encodings:

- `utf-8`
- `shift_jis`

The tool should not perform encoding auto detection in MVP.

If `encoding` is omitted, it defaults to:

```json
{
  "default": "utf-8",
  "extensions": {}
}
```

Encoding request shape:

```json
{
  "default": "utf-8",
  "extensions": {
    ".java": "shift_jis",
    ".properties": "shift_jis"
  }
}
```

Encoding selection precedence:

1. file entry `encoding`
2. matching `encoding.extensions` entry
3. `encoding.default`

`encoding.extensions` keys are exact file extensions including the leading dot,
such as `.java` or `.md`.

Extension matching should use the final extension of the basename. It is
case-sensitive in MVP.

Extension rules are only for selecting decode behavior. They do not discover
files, expand request entries, or traverse directories.

The result must include the effective encoding used for each returned file.
Because MVP does not perform auto detection, this is the encoding selected from
the request, either from the file entry override, an extension rule, or the
top-level default, not an inferred encoding guessed from file contents.

If a file cannot be decoded as the selected encoding, it must not be returned as
mojibake. The tool should return an error diagnostic such as `decode_error`.

## Limits

Defaults and maximums:

```text
maxFileBytes default: 10485760 bytes  (10 MiB)
maxFileBytes maximum: 104857600 bytes (100 MiB)

maxFiles default: 100
maxFiles maximum: 100

maxTotalBytes default: 4194304 bytes  (4 MiB)
maxTotalBytes maximum: 20971520 bytes (20 MiB)
```

Files larger than `maxFileBytes` should be skipped with a diagnostic such as
`max_file_bytes_exceeded`.

Requests with more than `maxFiles` file entries should fail validation.

`maxTotalBytes` is based on filesystem file sizes before decoding, not on the
byte size of normalized returned `text` or JSON output. For range reads, the
whole source file size still counts because the tool reads and decodes the file
to calculate logical lines.

If the total filesystem bytes of requested files would exceed `maxTotalBytes`,
the tool should fail with `ok: false` and a diagnostic such as
`max_total_bytes_exceeded`. It should not return a partially oversized result.

## Result JSON

Successful result example:

```json
{
  "version": 1,
  "ok": true,
  "files": [
    {
      "file": "src/Legacy.java",
      "encoding": "shift_jis",
      "bom": null,
      "lineEnding": "crlf",
      "finalNewline": true,
      "bytes": 12345,
      "lines": 320,
      "modifiedTime": "2026-05-03T05:30:00.000Z",
      "range": null,
      "text": "..."
    }
  ],
  "summary": {
    "requestedFiles": 1,
    "filesRead": 1,
    "filesSkipped": 0,
    "diagnostics": 0
  },
  "diagnostics": []
}
```

Top-level result fields:

- `version`: result schema version. MVP uses `1`.
- `ok`: true only when all requested files were read successfully.
- `files`: decoded file contents.
- `summary`: small count summary for agent and automation callers.
- `diagnostics`: warnings and errors.

`files` result order must preserve the request `files` order for successfully
read files. Failed files are represented in `diagnostics` and should not reorder
successful results.

## File Result

Each returned file result should include:

- `file`: root-relative file path using `/`.
- `encoding`: effective encoding used to decode that file.
- `bom`: removed BOM type, or `null` when no BOM was removed.
- `lineEnding`: original line ending style detected before LF normalization.
- `finalNewline`: whether the original decoded file ended with a line ending.
- `bytes`: file size in bytes from filesystem metadata.
- `lines`: total logical line count in the decoded file.
- `modifiedTime`: filesystem `mtime` as an ISO 8601 UTC string.
- `range`: `null` for whole-file reads, or effective returned range metadata.
- `text`: decoded text with LF-normalized line endings.

`birthtime` and `ctime` are out of scope for MVP.

Empty files should be returned as successful reads with `text: ""`,
`bytes: 0`, `lines: 0`, `finalNewline: false`, `lineEnding: "none"`, and
`range: null` for whole-file reads.

## Summary

Summary fields:

- `requestedFiles`: number of request `files` entries.
- `filesRead`: number of successfully returned file results.
- `filesSkipped`: number of requested file entries skipped or failed.
- `diagnostics`: number of diagnostics.

## Failure Results

If one or more requested files fail, `ok` must be `false`. Successfully read
files should still be returned in `files`.

A file-level skip is a file-level failure for the overall result. If any
requested file is skipped because of size, binary content, symlink, decode
error, `not_file`, path escape, or another expected file-level reason, the
overall result must be `ok: false`.

Failure result example:

```json
{
  "version": 1,
  "ok": false,
  "files": [
    {
      "file": "README.md",
      "encoding": "utf-8",
      "bom": null,
      "lineEnding": "lf",
      "finalNewline": true,
      "bytes": 1200,
      "lines": 42,
      "modifiedTime": "2026-05-03T05:30:00.000Z",
      "range": null,
      "text": "..."
    }
  ],
  "summary": {
    "requestedFiles": 2,
    "filesRead": 1,
    "filesSkipped": 1,
    "diagnostics": 1
  },
  "diagnostics": [
    {
      "severity": "error",
      "code": "decode_error",
      "message": "file could not be decoded",
      "file": "src/Legacy.java",
      "skipped": true
    }
  ]
}
```

## Diagnostics

Diagnostics should use this basic shape:

```json
{
  "severity": "error",
  "code": "decode_error",
  "message": "file could not be decoded",
  "file": "src/Legacy.java",
  "skipped": true
}
```

Use `file` for diagnostics tied to a requested file entry. `file` values should
be `request.root`-relative paths. Use `path` only for diagnostics that are not
tied to a normalized requested file, such as `root` accessibility failures.

Duplicate request entries should produce duplicate diagnostics when they fail.
Diagnostics should not be deduplicated across request entries.

## Range Reads

For a range read, the result should include the effective returned range.

```json
{
  "file": "src/Legacy.java",
  "encoding": "shift_jis",
  "bom": null,
  "lineEnding": "crlf",
  "finalNewline": true,
  "bytes": 12345,
  "lines": 320,
  "modifiedTime": "2026-05-03T05:30:00.000Z",
  "range": {
    "startLine": 120,
    "lineCount": 40,
    "endLine": 159,
    "eof": false
  },
  "text": "..."
}
```

`startLine` is 1-based. `lineCount` in the request is the number of lines to
return. For example, `startLine: 120` and `lineCount: 40` returns lines 120
through 159 when those lines exist.

If the file ends before all requested lines are returned, `eof` should be
`true` and `lineCount` should be the actual number of returned lines.

```json
{
  "file": "src/Legacy.java",
  "encoding": "shift_jis",
  "bom": null,
  "lineEnding": "crlf",
  "finalNewline": true,
  "bytes": 12345,
  "lines": 131,
  "modifiedTime": "2026-05-03T05:30:00.000Z",
  "range": {
    "startLine": 120,
    "lineCount": 12,
    "endLine": 131,
    "eof": true
  },
  "text": "..."
}
```

If `startLine` is after EOF, the read should still be successful. Return empty
text with `eof: true`, `lineCount: 0`, and `endLine: null`.

```json
{
  "file": "src/Legacy.java",
  "encoding": "shift_jis",
  "bom": null,
  "lineEnding": "crlf",
  "finalNewline": true,
  "bytes": 12345,
  "lines": 131,
  "modifiedTime": "2026-05-03T05:30:00.000Z",
  "range": {
    "startLine": 9999,
    "lineCount": 0,
    "endLine": null,
    "eof": true
  },
  "text": ""
}
```

Result `range.lineCount` may be `0` only when no lines are returned, such as
when `startLine` is after EOF.

## BOM Handling

If a UTF-8 BOM is present at the beginning of a decoded UTF-8 file, remove it
from `text` and return `bom: "utf-8"` in the file result.

If no BOM is removed, return `bom: null`.

BOM-like characters after the first character are preserved.

Shift_JIS BOM handling is out of scope for MVP.

BOM removal is ordinary file metadata, not a diagnostic. The tool should not
emit a warning only because a UTF-8 BOM was removed.

## Line Endings

Returned `text` should normalize line endings to LF (`\n`).

If the original decoded file ends with a line ending, returned `text` should
also end with `\n` after LF normalization. The final newline is part of the file
content and should be preserved.

Returned `text` should contain only file content. The tool should not prefix
lines with line numbers. Callers should use `range` metadata when they need line
position information.

Allowed `lineEnding` values:

- `lf`
- `crlf`
- `cr`
- `mixed`
- `none`

`none` means the decoded text contains no line ending sequence.

If a file contains multiple line ending styles, return `mixed`.

`finalNewline` should indicate whether the original decoded file ended with a
line ending sequence before LF normalization. This is useful when callers need
to generate patches or preserve text file shape.

`lines` should be the total logical line count for the decoded file, not the
number of returned lines in a range read. Range-specific returned line count is
reported in `range.lineCount`.

Range line calculation should use logical lines after recognizing CRLF, LF, and
CR as line endings. The returned range text should still use LF.

For range reads, the returned `text` should include a trailing `\n` only when
the last returned logical line originally ended with a line ending. The tool
should not add an artificial trailing newline to range output.

## Safety

MVP safety behavior:

- Resolve `root` to a real path.
- Treat the resolved root as the read boundary.
- Refuse roots that are too broad.
- Skip paths that resolve outside the root.
- Skip symlinks.
- Skip binary files.
- Skip files that exceed the file size limit.
- Return diagnostics for skipped files.

For MVP, `root_too_broad` should be limited to:

- filesystem root
- the user's home directory

Other broad-looking directories are out of scope for MVP.

Files that cannot be safely represented as decoded JSON text should not be
forced into output. They should be skipped or rejected with diagnostics.

Skipped requested files make the overall result `ok: false`, even when other
requested files are read successfully.

## Agent Usage Guidance

Generative AI agents should normally set `root` to the current repository root.

If an agent is about to use `miku-readfile` with a `root` outside the current
repository root, it should ask the user for explicit confirmation before running
the tool.

When reading outside the current repository root is approved, the approved
external directory should become `request.root`. The `files` entries should
remain root-relative paths, not absolute paths.

This mirrors the `miku-grep` usage policy. The tool is local-first, but reading
outside the active repository is a broader operation than ordinary repository
work and should not happen silently.

## Relationship With miku-grep

`miku-grep` is responsible for search.

`miku-readfile` is responsible for reading selected files.

Typical flow:

```text
miku-grep
  find candidate files and lines

miku-readfile
  read selected files as decoded JSON
```

`miku-readfile` should not grow search features unless a concrete need appears.

## Bundle Artifacts

The Node.js implementation should produce a single-file CLI runtime artifact for
downstream Agent Skills and local handoff use.

Current artifact names:

```text
bundle/miku-readfile.mjs
bundle/miku-readfile-sources.tgz
```

`bundle/miku-readfile.mjs` is the executable runtime artifact. It should run
without requiring the source tree and should embed the package version at build
time so `--version` still works outside the package directory.

`bundle/miku-readfile-sources.tgz` is for rebuild, audit, and downstream
verification. It is not required at runtime.

A bundle smoke check should verify `--version`, `--help`, stdin JSON execution,
and source archive contents.
