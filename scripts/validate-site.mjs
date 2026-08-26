import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
];
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function readSiteFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  check(fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
  return fs.readFileSync(absolutePath, "utf8");
}

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  check(fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
  if (fs.existsSync(absolutePath)) {
    check(fs.statSync(absolutePath).isFile(), `Required path is not a file: ${relativePath}`);
  }
}

let manifest;
try {
  manifest = JSON.parse(readSiteFile("manifest.webmanifest"));
} catch (error) {
  failures.push(`Invalid manifest.webmanifest JSON: ${error.message}`);
}

if (manifest) {
  check(typeof manifest.start_url === "string" && !manifest.start_url.startsWith("/"), "Manifest start_url must be relative for project Pages hosting.");
  check(manifest.scope === "./", "Manifest scope must be ./ for project Pages hosting.");
  check(Array.isArray(manifest.icons) && manifest.icons.length > 0, "Manifest must declare at least one icon.");
}

const html = readSiteFile("index.html");
const htmlReferences = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
for (const reference of htmlReferences) {
  if (/^(?:https?:|data:|mailto:|#)/i.test(reference)) continue;
  check(!reference.startsWith("/"), `HTML asset reference must be relative: ${reference}`);

  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference) continue;
  const absoluteReference = path.resolve(root, cleanReference);
  const relativeReference = path.relative(root, absoluteReference);
  check(!relativeReference.startsWith("..") && !path.isAbsolute(relativeReference), `HTML asset escapes the site root: ${reference}`);
  check(fs.existsSync(absoluteReference), `HTML asset does not exist: ${reference}`);
}

const serviceWorker = readSiteFile("sw.js");
const cachedReferences = [...serviceWorker.matchAll(/["'](\.\/[^"']+)["']/g)].map((match) => match[1]);
for (const reference of cachedReferences) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const absoluteReference = path.resolve(root, cleanReference);
  check(fs.existsSync(absoluteReference), `Service-worker asset does not exist: ${reference}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${requiredFiles.length} required site files, manifest metadata, HTML references, and service-worker assets.`);
}
