const { existsSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const installer = path.join(__dirname, "..", "dist", "install-launchers.js");

if (existsSync(installer)) {
  import(pathToFileURL(installer).href).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`almanac: launcher install failed: ${message}\n`);
    process.exitCode = 1;
  });
}
