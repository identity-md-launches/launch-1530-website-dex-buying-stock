import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const budget = 8_388_608;
const reportPath = "artifacts/bundle-check.json";
const excluded = new Set([
  ".git",
  ".github",
  ".imd",
  ".agents",
  ".codex",
  ".playwright-mcp",
  "test/scratch",
]);
const forbidden = new Set([
  "node_modules",
  ".npm",
  ".pnpm-store",
  ".cache",
  ".vite",
]);
async function filesAt(dir = "") {
  const files = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (
      excluded.has(path) ||
      entry.name === ".env" ||
      entry.name.startsWith(".env.")
    )
      continue;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${path}`);
    if (forbidden.has(entry.name))
      throw new Error(`Dependency/cache directory inside delivery: ${path}`);
    if (/\.(tgz|zip|tar|gz)$/.test(entry.name))
      throw new Error(`Unnecessary packaging archive: ${path}`);
    if (entry.isDirectory()) files.push(...(await filesAt(path)));
    else if (entry.isFile())
      files.push({ path, bytes: (await stat(join(root, path))).size });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const html = await readFile("dist/index.html", "utf8");
for (const entry of [
  ...html.matchAll(/(?:src|href|content)="(\.\/[^"#]+)"/g),
]) {
  const asset = resolve("dist", entry[1]);
  if (!asset.startsWith(resolve("dist") + "/"))
    throw new Error(`Asset escapes export: ${entry[1]}`);
  await stat(asset);
}
if (/(?:src|href)="\/assets\//.test(html))
  throw new Error("Root-relative asset URL.");
for (const file of await filesAt("dist")) {
  if (file.path.endsWith(".css")) {
    const css = await readFile(file.path, "utf8");
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1].startsWith("data:")) continue;
      if (/^(?:https?:|\/)/.test(match[1]))
        throw new Error(`Nonlocal CSS asset: ${match[1]}`);
      await stat(resolve(dirname(file.path), match[1]));
    }
  }
}
const ignoreBytes = (await stat(".gitignore")).size;
if (ignoreBytes > 512)
  throw new Error("Explicit .gitignore path budget exceeded.");
const exportFiles = await filesAt("dist");
const hashes = await Promise.all(
  exportFiles.map(async (file) => ({
    ...file,
    sha256: createHash("sha256")
      .update(await readFile(file.path))
      .digest("hex"),
  })),
);
let report;
for (let pass = 0; pass < 6; pass++) {
  const files = await filesAt();
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  report = {
    measuredAt: new Date().toISOString().slice(0, 10),
    budgetBytes: budget,
    payloadBytes: bytes,
    withinBudget: bytes < budget,
    fileCount: files.length,
    exportBytes: exportFiles.reduce((sum, file) => sum + file.bytes, 0),
    ignorePathBudgetBytes: 512,
    ignoreActualBytes: ignoreBytes,
    relativeAssetsVerified: true,
    symlinks: 0,
    dependencyOrCacheDirectories: 0,
    excludedInputAndLocalDirectories: [...excluded],
    exportFiles: hashes,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  const actual = (await filesAt()).reduce((sum, file) => sum + file.bytes, 0);
  if (actual === bytes) break;
}
if (!report.withinBudget) throw new Error(`Payload exceeds ${budget} bytes.`);
console.log(JSON.stringify(report, null, 2));
