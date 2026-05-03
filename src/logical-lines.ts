export type LogicalLines = {
  lines: string[];
  lineHadEnding: boolean[];
};

export function splitLogicalLines(text: string): LogicalLines {
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
