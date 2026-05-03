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

export function rangeText(shape: TextShape, startLine: number, requestedLineCount: number): { text: string; lineCount: number; endLine: number | null; eof: boolean } {
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

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function collectLineEndings(text: string): { values: Set<"lf" | "crlf" | "cr">; finalNewline: boolean } {
  const values = new Set<"lf" | "crlf" | "cr">();
  let finalNewline = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\r") {
      if (text[index + 1] === "\n") {
        values.add("crlf");
        finalNewline = index + 2 === text.length;
        index += 1;
      } else {
        values.add("cr");
        finalNewline = index + 1 === text.length;
      }
    } else if (char === "\n") {
      values.add("lf");
      finalNewline = index + 1 === text.length;
    }
  }
  return { values, finalNewline };
}

function classifyLineEnding(values: Set<"lf" | "crlf" | "cr">): LineEnding {
  if (values.size === 0) return "none";
  if (values.size > 1) return "mixed";
  return [...values][0] ?? "none";
}

function splitLogicalLines(text: string): { lines: string[]; lineHadEnding: boolean[] } {
  if (text.length === 0) return { lines: [], lineHadEnding: [] };
  const lines: string[] = [];
  const lineHadEnding: boolean[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\r" || char === "\n") {
      lines.push(text.slice(start, index));
      lineHadEnding.push(true);
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      start = index + 1;
    }
  }
  if (start < text.length) {
    lines.push(text.slice(start));
    lineHadEnding.push(false);
  }
  return { lines, lineHadEnding };
}
