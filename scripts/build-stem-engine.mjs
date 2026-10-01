import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDirectory = path.join(root, "vendor");
const runtimeDirectory = path.join(vendorDirectory, "ort");
const runtimeFiles = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

await fs.mkdir(runtimeDirectory, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: [
    "src/stem-separation-engine.js",
    "src/htdemucs-separation-engine.js",
  ],
  outdir: "vendor",
  outbase: "src",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
});

for (const fileName of runtimeFiles) {
  await fs.copyFile(
    path.join(root, "node_modules", "onnxruntime-web", "dist", fileName),
    path.join(runtimeDirectory, fileName),
  );
}

console.log(`Built both local stem workers and ${runtimeFiles.length} ONNX Runtime Web assets.`);
