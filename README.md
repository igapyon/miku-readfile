# miku-readfile

`miku-readfile` は、生成AI agent や automation が local workspace の text file を安定して読むための小さな local-first CLI です。

主な目的は、一部の生成AIツールが Shift_JIS file を安定して読めない現状を補うことです。明示指定された file だけを UTF-8 または Shift_JIS として decode し、JSON result として返します。

この tool は検索しません。読むべき file を探す場合は `miku-grep` を使い、選んだ file を `miku-readfile` で読む想定です。

## 方針

- 読み込みだけを行う
- JSON request を stdin で受け取る
- JSON result を stdout に返す
- UTF-8 / Shift_JIS を扱う
- 文字化けを黙って返さず diagnostics にする
- 明示指定された regular file だけを読む
- root 外へ解決される path は読まない
- MCP、GUI、server、daemon、検索、directory traversal は持たない

## 想定 Usage

最小 request:

```json
{
  "version": 1,
  "root": ".",
  "files": ["README.md"]
}
```

Shift_JIS の Java file を含む request 例:

```json
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
```

行範囲を読む request 例:

```json
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
```

CLI contract:

```bash
miku-readfile < request.json > result.json
```

`--version` と `--help` は stdin JSON なしで実行でき、stdout に plain text を返す例外です。

```bash
miku-readfile --version
miku-readfile --help
```

## Development Usage

This repository currently provides the Node.js CLI implementation.

```bash
npm install
npm run build
node dist/main.js < request.json > result.json
```

Package contents can be checked with:

```bash
npm run pack:check
```

If the local npm cache has permission issues, use a temporary cache path:

```bash
npm --cache /private/tmp/miku-readfile-npm-cache pack --dry-run
```

## Runtime Artifacts

`npm run build` creates the normal package runtime and a single-file CLI runtime artifact.

- `dist/main.js`
- `bundle/miku-readfile.mjs`
- `bundle/miku-readfile-sources.tgz`

`bundle/miku-readfile.mjs` is a self-contained Node.js CLI runtime artifact for downstream Agent Skills and local handoff use.

`bundle/miku-readfile-sources.tgz` is for rebuild, audit, and downstream verification. It is not required at runtime.

The bundle smoke check is:

```bash
npm run smoke:bundle
```

## Working With miku-grep

`miku-grep` と `miku-readfile` は役割を分けて使います。

1. `miku-grep` で repository 内の候補 file を探す。
2. 検索 result JSON の root-relative file path を選ぶ。
3. 選んだ file path を `miku-readfile` の `files` に渡して全文または行範囲を読む。

例:

```json
{
  "version": 1,
  "root": ".",
  "files": [
    "README.md",
    {
      "path": "docs/miku-readfile-cli-spec.md",
      "range": {
        "startLine": 1,
        "lineCount": 80
      }
    }
  ]
}
```

## Result

Result JSON には、decoded text と一緒に file metadata を返します。

- effective encoding
- BOM handling
- line ending
- final newline
- byte size
- logical line count
- filesystem mtime
- range metadata
- summary
- diagnostics

失敗した file が 1 件でもある場合、全体 result は `ok: false` になります。読めた file は `files` に返し、読めなかった file は `diagnostics` に理由を返します。

## Security And Scope

`miku-readfile` の読み取り境界は `request.root` です。

通常、生成AI agent は current repository root を `root` に指定します。repository root 外を読む必要がある場合は、利用者が明示的に許可した directory を `request.root` にします。`files` は常に `root` からの相対 path です。

`files` に absolute path は指定できません。`..` を含む path も validation error です。

## Documentation

詳細仕様は [docs/miku-readfile-cli-spec.md](docs/miku-readfile-cli-spec.md) を参照してください。

関連する miku software series の設計メモは `docs/miku-soft-*.md` にあります。

## Status

現在は MVP 実装と single-file CLI bundle 生成を追加済みです。詳細な残作業は [TODO.md](TODO.md) を参照してください。
