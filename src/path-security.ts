import path from "node:path";

export function isPathInsideOrSame(candidate: string, base: string): boolean {
  const relative = path.relative(base, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function toJsonPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function hasParentSegment(filePath: string): boolean {
  return filePath.split("/").includes("..");
}
