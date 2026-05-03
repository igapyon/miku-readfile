# TODO

## Current Status

- 仕様検討はいったん完了。
- CLI 仕様ドラフトは `docs/miku-readfile-cli-spec.md` に整理済み。
- package version は `0.5.0`。
- README は概要と想定 usage を記載済み。
- MVP の初期実装を追加済み。
- `npm run build` は通過済み。
- `npm run smoke:bundle` は通過済み。
- `npm audit --audit-level=moderate` は 0 vulnerabilities。
- Vitest は 25 tests まで追加済み。
- `bundle/miku-readfile.mjs` と `bundle/miku-readfile-sources.tgz` の生成を追加済み。
- GitHub Release asset workflow を追加済み。

## Implemented In Initial Pass

- Node CLI project skeleton
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/` and `test/` structure
- stdin JSON request / stdout JSON result CLI entry
- `--version`
- `--help`
- exit codes
- strict request validation
- root realpath boundary check
- regular file read
- UTF-8 decode
- Shift_JIS decode
- default / extension / per-file encoding selection
- UTF-8 BOM handling
- line ending detection
- LF normalization
- `finalNewline`
- `lines`
- whole-file read
- range read
- file metadata
- summary
- diagnostics shape
- maxFileBytes / maxFiles / maxTotalBytes
- Vitest coverage for main read paths and CLI contract
- single-file Node.js CLI runtime artifact
- source archive for rebuild / audit / downstream verification
- package metadata basics: license, repository, homepage, bugs, keywords, bin, files
- GitHub Release workflow for CLI bundle assets

## Remaining Implementation Tasks

- Review implementation against every item in `docs/miku-readfile-cli-spec.md`.
- Improve CLI help text further if release review finds gaps.

## Additional Tests To Add

- Add platform-specific regression cases only if new filesystem edge cases appear.

## Documentation Before Release

- README の usage を実際の published install 方法に合わせて更新する。
- CLI help text を `docs/miku-readfile-cli-spec.md` と同期する。
- `npm publish` は現時点では実行しない。
