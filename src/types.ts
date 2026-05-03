export type SupportedEncoding = "utf-8" | "shift_jis";
export type Severity = "error" | "warning" | "info";
export type Bom = "utf-8" | null;
export type LineEnding = "lf" | "crlf" | "cr" | "mixed" | "none";

export type MikuReadfileRequest = {
  version: 1;
  root: string;
  files: FileRequestEntry[];
  encoding?: EncodingRequest;
  limits?: LimitsRequest;
};

export type FileRequestEntry =
  | string
  | {
      path: string;
      range?: RangeRequest;
      encoding?: SupportedEncoding;
    };

export type RangeRequest = {
  startLine: number;
  lineCount: number;
};

export type EncodingRequest = {
  default?: SupportedEncoding;
  extensions?: Record<string, SupportedEncoding>;
};

export type LimitsRequest = {
  maxFileBytes?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
};

export type EffectiveFileRequest = {
  path: string;
  range: RangeRequest | null;
  encoding: SupportedEncoding | null;
};

export type EffectiveRequest = {
  version: 1;
  root: string;
  files: EffectiveFileRequest[];
  encoding: {
    default: SupportedEncoding;
    extensions: Record<string, SupportedEncoding>;
  };
  limits: {
    maxFileBytes: number;
    maxFiles: number;
    maxTotalBytes: number;
  };
};

export type Diagnostic = {
  severity: Severity;
  code: string;
  message: string;
  file?: string;
  path?: string;
  skipped?: boolean;
  details?: Record<string, unknown>;
};

export type RangeResult = {
  startLine: number;
  lineCount: number;
  endLine: number | null;
  eof: boolean;
};

export type FileResult = {
  file: string;
  encoding: SupportedEncoding;
  bom: Bom;
  lineEnding: LineEnding;
  finalNewline: boolean;
  bytes: number;
  lines: number;
  modifiedTime: string;
  range: RangeResult | null;
  text: string;
};

export type Summary = {
  requestedFiles: number;
  filesRead: number;
  filesSkipped: number;
  diagnostics: number;
};

export type MikuReadfileResult = {
  version: 1;
  ok: boolean;
  files: FileResult[];
  summary: Summary;
  diagnostics: Diagnostic[];
};

export type ValidationResult =
  | { ok: true; effectiveRequest: EffectiveRequest }
  | { ok: false; code: string; message: string; path?: string };
