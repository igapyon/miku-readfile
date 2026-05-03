import { normalizeLineEndings } from "./line-endings.js";
import type { TextShape } from "./text-shape.js";

export type RangeTextResult = {
  text: string;
  lineCount: number;
  endLine: number | null;
  eof: boolean;
};

export function rangeText(shape: TextShape, startLine: number, requestedLineCount: number): RangeTextResult {
  if (startLine > shape.logicalLineCount) return { text: "", lineCount: 0, endLine: null, eof: true };
  const startIndex = startLine - 1;
  const available = shape.logicalLineCount - startIndex;
  const lineCount = Math.min(requestedLineCount, available);
  const endLine = startLine + lineCount - 1;
  const eof = lineCount < requestedLineCount;
  let text = "";
  for (let index = startIndex; index < startIndex + lineCount; index += 1) {
    text += normalizeLineEndings(shape.lines[index] ?? "");
    if (shape.lineHadEnding[index]) text += "\n";
  }
  return { text, lineCount, endLine, eof };
}
