import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeTextFileAtomically(
  path: string,
  body: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(tmp, body, "utf8");
    await rename(tmp, path);
  } catch (err: unknown) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}
