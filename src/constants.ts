export const VERSION = 1;

export const LIMITS = {
  maxFileBytes: 104857600,
  maxFiles: 100,
  maxTotalBytes: 20971520,
};

export const DEFAULTS = {
  encoding: {
    default: "utf-8" as const,
    extensions: {} as Record<string, "utf-8" | "shift_jis">,
  },
  limits: {
    maxFileBytes: 10485760,
    maxFiles: 100,
    maxTotalBytes: 4194304,
  },
};

export const REQUEST_SHAPE = {
  version: true,
  root: true,
  files: true,
  encoding: { default: true, extensions: true },
  limits: { maxFileBytes: true, maxFiles: true, maxTotalBytes: true },
} satisfies Record<string, true | Record<string, true>>;
