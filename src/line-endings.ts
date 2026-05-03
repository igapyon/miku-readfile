import type { LineEnding } from "./types.js";

export type RawLineEnding = "lf" | "crlf" | "cr";

export type LineEndingScan = {
  values: Set<RawLineEnding>;
  finalNewline: boolean;
};

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function collectLineEndings(text: string): LineEndingScan {
  const values = new Set<RawLineEnding>();
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

export function classifyLineEnding(values: Set<RawLineEnding>): LineEnding {
  if (values.size === 0) return "none";
  if (values.size > 1) return "mixed";
  return [...values][0] ?? "none";
}
