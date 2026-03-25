import { readdir, mkdir, rm } from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";

const SRC_DIR = join(import.meta.dirname, "..", "src");
const DIST_DIR = join(import.meta.dirname, "..", "dist");

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(fullPath)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function build() {
  await rm(DIST_DIR, { recursive: true, force: true });

  const files = await collectTsFiles(SRC_DIR);

  for (const file of files) {
    const rel = relative(SRC_DIR, file);
    const outDir = join(DIST_DIR, dirname(rel));
    const outName = basename(rel).replace(/\.ts$/, ".js");
    await mkdir(outDir, { recursive: true });
    const result = await Bun.build({
      entrypoints: [file],
      outdir: outDir,
      naming: outName,
      target: "node",
      format: "esm",
      external: ["*"],
    });
    if (!result.success) {
      console.error(`Failed to build ${rel}:`, result.logs);
      process.exit(1);
    }
  }

  console.log(`Built ${files.length} files to dist/`);
}

build();
