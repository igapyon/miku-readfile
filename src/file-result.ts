import { toJsonPath } from "./path-security.js";
import { rangeText } from "./range-text.js";
import { shapeText } from "./text-shape.js";
import type { EffectiveFileRequest, FileResult, SupportedEncoding } from "./types.js";

export function createFileResult(input: {
  file: EffectiveFileRequest;
  encoding: SupportedEncoding;
  decoded: string;
  utf8BomPresent: boolean;
  bytes: number;
  modifiedTime: string;
}): FileResult {
  const shaped = shapeText(input.decoded, input.encoding, input.utf8BomPresent);
  const effectiveRange = input.file.range ? rangeText(shaped, input.file.range.startLine, input.file.range.lineCount) : null;
  return {
    file: toJsonPath(input.file.path),
    encoding: input.encoding,
    bom: shaped.bom,
    lineEnding: shaped.lineEnding,
    finalNewline: shaped.finalNewline,
    bytes: input.bytes,
    lines: shaped.logicalLineCount,
    modifiedTime: input.modifiedTime,
    range: input.file.range && effectiveRange ? {
      startLine: input.file.range.startLine,
      lineCount: effectiveRange.lineCount,
      endLine: effectiveRange.endLine,
      eof: effectiveRange.eof,
    } : null,
    text: effectiveRange ? effectiveRange.text : shaped.text,
  };
}
