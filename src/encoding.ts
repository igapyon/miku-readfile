import path from "node:path";
import iconv from "iconv-lite";
import type { EffectiveFileRequest, EffectiveRequest, SupportedEncoding } from "./types.js";

export function selectEncoding(request: EffectiveRequest, file: EffectiveFileRequest): SupportedEncoding {
  if (file.encoding) return file.encoding;
  const extension = path.posix.extname(file.path);
  return request.encoding.extensions[extension] ?? request.encoding.default;
}

export function decode(bytes: Uint8Array, encoding: SupportedEncoding): string {
  if (encoding === "utf-8") return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return iconv.decode(Buffer.from(bytes), "shift_jis");
}
