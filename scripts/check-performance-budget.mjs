import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const CHUNKS_DIR = path.join(process.cwd(), ".next", "static", "chunks");
const MAX_TOTAL_GZIP_BYTES = 600_000;
const MAX_CHUNK_GZIP_BYTES = 100_000;
const MAX_CSS_GZIP_BYTES = 50_000;

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(filePath)));
    else if (/\.(?:js|css)$/.test(entry.name)) files.push(filePath);
  }
  return files;
}

try {
  await stat(CHUNKS_DIR);
} catch {
  console.error("Performance budget: .next/static/chunks does not exist. Run npm run build first.");
  process.exit(1);
}

const files = await collectFiles(CHUNKS_DIR);
const assets = await Promise.all(
  files.map(async (filePath) => {
    const raw = await readFile(filePath);
    return {
      file: path.relative(process.cwd(), filePath),
      type: filePath.endsWith(".css") ? "css" : "js",
      gzipBytes: gzipSync(raw, { level: 9 }).length,
    };
  })
);

const totalGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const largest = [...assets].sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, 5);
const violations = assets.filter(
  (asset) =>
    asset.gzipBytes > MAX_CHUNK_GZIP_BYTES ||
    (asset.type === "css" && asset.gzipBytes > MAX_CSS_GZIP_BYTES)
);

console.log(`Performance budget: ${assets.length} JS/CSS chunks, ${(totalGzipBytes / 1024).toFixed(1)} KiB gzip total.`);
console.log("Largest chunks:");
for (const asset of largest) {
  console.log(`  ${(asset.gzipBytes / 1024).toFixed(1)} KiB  ${asset.file}`);
}

if (totalGzipBytes > MAX_TOTAL_GZIP_BYTES) {
  violations.push({ file: "all chunks", type: "total", gzipBytes: totalGzipBytes });
}

if (violations.length > 0) {
  console.error("Performance budget failed:");
  for (const violation of violations) {
    console.error(`  ${(violation.gzipBytes / 1024).toFixed(1)} KiB gzip  ${violation.file}`);
  }
  process.exit(1);
}

console.log("Performance budget passed.");
