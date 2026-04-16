import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    codealmanac: "bin/codealmanac.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false,
  shims: false,
  // Keep CJS/native dependencies external so Node's resolver handles them
  // at runtime. `better-sqlite3` is a native module (loads a `.node`
  // binary via `bindings`); `fast-glob` uses dynamic CommonJS `require()`
  // internally and breaks when bundled into ESM. `js-yaml` could be
  // bundled but we keep it external for consistency with its peers.
  external: ["better-sqlite3", "fast-glob", "js-yaml"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  outDir: "dist",
});
