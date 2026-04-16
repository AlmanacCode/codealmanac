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
  banner: {
    js: "#!/usr/bin/env node",
  },
  outDir: "dist",
});
