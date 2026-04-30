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
  // Keep the CLI graph in a separate dynamic chunk so the entrypoint can
  // run the better-sqlite3 ABI guard before any command module imports
  // the native binding.
  splitting: true,
  minify: false,
  shims: false,
  // Keep CJS/native dependencies external so Node's resolver handles them
  // at runtime. `better-sqlite3` is a native module (loads a `.node`
  // binary via `bindings`); `fast-glob` uses dynamic CommonJS `require()`
  // internally and breaks when bundled into ESM. `js-yaml` could be
  // bundled but we keep it external for consistency with its peers.
  //
  // The Claude Agent SDK family (`@anthropic-ai/claude-agent-sdk` plus its
  // runtime peers `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`)
  // ships its own binaries/vendored CLI and uses dynamic imports that
  // bundlers can't follow. Always resolved at runtime from `node_modules`.
  external: [
    "better-sqlite3",
    "fast-glob",
    "js-yaml",
    "@anthropic-ai/claude-agent-sdk",
    "@anthropic-ai/sdk",
    "@modelcontextprotocol/sdk",
  ],
  banner: {
    js: "#!/usr/bin/env node",
  },
  outDir: "dist",
});
