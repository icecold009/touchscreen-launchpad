import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "index.html",
  "style.css",
  "app.js",
  "src/bootstrap.js",
  "src/history.js",
  "src/input-adapter.js",
  "src/migrations.js",
  "src/pointer-state.js",
  "src/storage-request.js",
  "src/download.js",
  "src/recording.js",
  "src/sample-editor.js",
  "src/transport.js",
  "src/voice-registry.js",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
];
const pagesWorkflowPath = ".github/workflows/pages.yml";

function check(failures, condition, message) {
  if (!condition) failures.push(message);
}

function readSiteFile(rootDirectory, relativePath, failures) {
  const absolutePath = path.join(rootDirectory, relativePath);
  check(failures, fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function isInsideRoot(rootDirectory, absolutePath) {
  const relativePath = path.relative(rootDirectory, absolutePath);
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function moduleImports(source) {
  return [...source.matchAll(/\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s*)?["']([^"']+)["']/g)]
    .map((match) => match[1]);
}

export function validateModuleGraph(rootDirectory, entryReferences) {
  const failures = [];
  const visited = new Set();

  function visit(reference, importerPath = null) {
    if (importerPath && !reference.startsWith(".")) {
      failures.push(`Browser module import must be relative: ${reference}`);
      return;
    }
    if (!importerPath && (/^(?:[a-z]+:|\/)/i.test(reference))) {
      failures.push(`Browser module entrypoint must be relative: ${reference}`);
      return;
    }

    const cleanReference = reference.split(/[?#]/, 1)[0];
    const baseDirectory = importerPath ? path.dirname(importerPath) : rootDirectory;
    const absolutePath = path.resolve(baseDirectory, cleanReference);
    if (!isInsideRoot(rootDirectory, absolutePath)) {
      failures.push(`Browser module import escapes the site root: ${reference}`);
      return;
    }

    const displayPath = path.relative(rootDirectory, absolutePath).replaceAll("\\", "/");
    if (!fs.existsSync(absolutePath)) {
      failures.push(`Browser module does not exist: ${displayPath}`);
      return;
    }
    if (visited.has(absolutePath)) return;
    visited.add(absolutePath);

    const source = fs.readFileSync(absolutePath, "utf8");
    const syntaxCheck = spawnSync(process.execPath, ["--input-type=module", "--check"], {
      encoding: "utf8",
      input: source,
    });
    if (syntaxCheck.status !== 0) {
      failures.push(`Browser module has invalid syntax: ${displayPath}`);
      return;
    }

    for (const importedReference of moduleImports(source)) {
      visit(importedReference, absolutePath);
    }
  }

  for (const entryReference of entryReferences) visit(entryReference);
  return { failures, modules: [...visited] };
}

export function validateSite(rootDirectory = root) {
  const failures = [];

  for (const relativePath of requiredFiles) {
    const absolutePath = path.join(rootDirectory, relativePath);
    check(failures, fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
    if (fs.existsSync(absolutePath)) {
      check(failures, fs.statSync(absolutePath).isFile(), `Required path is not a file: ${relativePath}`);
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(readSiteFile(rootDirectory, "manifest.webmanifest", failures));
  } catch (error) {
    failures.push(`Invalid manifest.webmanifest JSON: ${error.message}`);
  }

  if (manifest) {
    check(failures, typeof manifest.start_url === "string" && !manifest.start_url.startsWith("/"), "Manifest start_url must be relative for project Pages hosting.");
    check(failures, manifest.scope === "./", "Manifest scope must be ./ for project Pages hosting.");
    check(failures, manifest.display === "standalone", "Manifest display must be standalone for installable app behavior.");
    check(failures, Array.isArray(manifest.icons) && manifest.icons.length > 0, "Manifest must declare at least one icon.");
    for (const icon of manifest.icons || []) {
      if (typeof icon.src !== "string") continue;
      const iconPath = path.resolve(rootDirectory, icon.src.split(/[?#]/, 1)[0]);
      check(failures, fs.existsSync(iconPath), `Manifest icon does not exist: ${icon.src}`);
    }
  }

  const html = readSiteFile(rootDirectory, "index.html", failures);
  const htmlReferences = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const reference of htmlReferences) {
    if (/^(?:https?:|data:|mailto:|#)/i.test(reference)) continue;
    check(failures, !reference.startsWith("/"), `HTML asset reference must be relative: ${reference}`);

    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!cleanReference) continue;
    const absoluteReference = path.resolve(rootDirectory, cleanReference);
    check(failures, isInsideRoot(rootDirectory, absoluteReference), `HTML asset escapes the site root: ${reference}`);
    check(failures, fs.existsSync(absoluteReference), `HTML asset does not exist: ${reference}`);
  }

  const moduleEntries = [...html.matchAll(/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*>/gi)]
    .map((match) => match[1]);
  check(failures, moduleEntries.length > 0, "HTML must declare at least one browser module entrypoint.");
  const moduleResult = validateModuleGraph(rootDirectory, moduleEntries);
  failures.push(...moduleResult.failures);

  const serviceWorker = readSiteFile(rootDirectory, "sw.js", failures);
  const cachedReferences = [...serviceWorker.matchAll(/["'](\.\/[^"']+)["']/g)].map((match) => match[1]);
  for (const reference of cachedReferences) {
    const cleanReference = reference.split(/[?#]/, 1)[0];
    const absoluteReference = path.resolve(rootDirectory, cleanReference);
    check(failures, fs.existsSync(absoluteReference), `Service-worker asset does not exist: ${reference}`);
  }

  const pagesWorkflow = readSiteFile(rootDirectory, pagesWorkflowPath, failures);
  check(failures, pagesWorkflow.includes("npm run validate"), "Pages workflow must run the repository validation contract.");
  check(failures, pagesWorkflow.includes("cp -R src _site/src"), "Pages workflow must stage browser modules under _site/src.");
  check(failures, !pagesWorkflow.includes("codex/launchpad-*"), "Pages workflow must not deploy feature branches to the production Pages site.");
  check(failures, pagesWorkflow.includes("github.ref == 'refs/heads/main'"), "Pages deployment must be restricted to main.");

  return { failures, moduleCount: moduleResult.modules.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateSite();
  if (result.failures.length) {
    console.error(result.failures.map((failure) => `- ${failure}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${requiredFiles.length} required site files, ${result.moduleCount} browser modules, manifest metadata, HTML references, and service-worker assets.`);
  }
}
