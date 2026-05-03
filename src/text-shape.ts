import { classifyLineEnding, collectLineEndings, normalizeLineEndings } from "./line-endings.js";
import { splitLogicalLines } from "./logical-lines.js";
import type { Bom, LineEnding } from "./types.js";

export type TextShape = {
  text: string;
  bom: Bom;
  lineEnding: LineEnding;
  finalNewline: boolean;
  lines: string[];
  lineHadEnding: boolean[];
  logicalLineCount: number;
};

export function shapeText(decoded: string, encoding: string, utf8BomPresent = false): TextShape {
  let text = decoded;
  let bom: Bom = null;
  if (encoding === "utf-8" && (utf8BomPresent || text.charCodeAt(0) === 0xfeff)) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    bom = "utf-8";
  }

  const endings = collectLineEndings(text);
  const lineEnding = classifyLineEnding(endings.values);
  const normalized = normalizeLineEndings(text);
  const finalNewline = endings.finalNewline;
  const { lines, lineHadEnding } = splitLogicalLines(text);
  const logicalLineCount = text.length === 0 ? 0 : lines.length;

  return {
    text: normalized,
    bom,
    lineEnding,
    finalNewline,
    lines,
    lineHadEnding,
    logicalLineCount,
  };
}
