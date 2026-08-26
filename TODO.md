# Final Luna plan — Touchscreen Launchpad

Repository: `C:\Users\91829\OneDrive\Documents\GitHub\touchscreen-launchpad`
Reviewed: clean `main` at `81dbd64` on 2026-08-25
Feature branch: `codex/luna-launchpad-lifecycle-tests`

## Current verified baseline

- `node --check app.js` and `node --check sw.js` pass.
- The repository has no package manifest or `npm run validate`; the previous TODO command was inaccurate.
- Reviewed hover rules are gated and object URLs are revoked after a delay.
- Pointer maps handle pointerup, pointercancel, and lost capture, but there is no page visibility/blur cleanup.

## Code-review conclusion

The remaining work is lifecycle proof. A hidden/interrupted page can retain pointer bookkeeping or pressed state until a pointer lifecycle event arrives, and the project lacks automated DOM/PWA checks. Preserve its no-build simplicity while adding a minimal repeatable verification layer.

## Build checklist

- [x] **1. Add a minimal verification contract**
  Files: new small `package.json` only if justified, test config, README.
  What to build: Provide scripts for JavaScript syntax, service-worker syntax, DOM/browser tests, and optional static asset validation without adding a production bundle step. **Done:** `package.json` exposes syntax, static, DOM-contract, and aggregate validation commands; the existing static validator is part of that contract.
  Acceptance: The app remains plain static files and a clean checkout can run all local checks reproducibly. **Verified:** no production bundle step or runtime dependency was added.
  Verify: `npm.cmd ci` then `npm.cmd run validate`.

- [ ] **2. Centralize pointer interruption cleanup**
  Files: `app.js`, tests.
  What to build: On visibility change, blur, pagehide, teardown/rerender, pointercancel, and lost capture, release bookkeeping, remove pressed styles, cancel queued pad state where appropriate, and avoid duplicate triggers. **In progress:** centralized cleanup now covers hidden visibility, blur, pagehide, orientation change, and pad rerender; pointer ownership rejects duplicate pointer and pad claims. Local contract tests and normal pointer release pass; direct synthetic cancel/capture-loss evidence remains open.
  Acceptance: Multi-touch interruption cannot leave a pad visually pressed or logically owned by a dead pointer.
  Verify: Browser tests with synthetic multiple pointers, cancel, capture loss, hidden tab, and orientation change.

- [ ] **3. Prove audio interruption and stop-all**
  Files: audio state logic and status UI.
  What to build: Handle suspended/unavailable AudioContext, decode/output failure, visibility interruption, loop cancellation, and stop-all while keeping tempo/quantization state explicit.
  Acceptance: No stuck loop or playing state survives a handled interruption; rapid pads are not announced noisily.
  Verify: Mocked audio tests plus physical/browser audio smoke.

- [ ] **4. Finish IndexedDB recovery UX**
  Files: storage adapter, editor status, import/export.
  What to build: Distinguish saved, saving, quota, upgrade, corrupt record, unavailable, and memory-only. Offer export/repair/reset without silent deletion.
  Acceptance: A pattern can be created, reloaded, exported, and recovered offline or the limitation is explicit.
  Verify: Browser tests with rejected DB operations and corrupted records.

- [ ] **5. Test download and import/export boundaries**
  Files: download helper, import validation, tests.
  What to build: Cover repeated/large/cancelled downloads, delayed download start, clipboard/file failures, invalid JSON, schema version, and missing sample bytes.
  Acceptance: Cleanup never races the download and failed export/import preserves user content.
  Verify: Chromium plus at least one second browser engine if available.

- [ ] **6. Verify PWA update/offline behavior**
  Files: service worker, manifest, update status, Pages workflow.
  What to build: Make cache version/update/stale state understandable; verify scope, icons, installability, update activation, and offline reload on the intended Pages origin.
  Acceptance: The workflow targets the actual release branch and no local check is called deployment proof.
  Verify: service-worker browser tests and deployed Lighthouse/PWA inspection.

- [ ] **7. Run physical touchscreen proof**
  What to build: Record multi-touch, latency, orientation, safe areas, background/foreground, install, and offline behavior on at least one actual touchscreen.
  Acceptance: Emulation and physical results are labelled separately; audio/sample licenses are documented.
  Verify: Final local scripts, `git diff --check`, physical-device matrix.

## Commit checkpoints

1. `test(launchpad): add static lifecycle verification`
2. `fix(launchpad): clear interrupted pointer and audio state`
3. `feat(launchpad): expose storage and PWA recovery states`

## Definition of done

- [ ] Interrupted pointers/audio cannot leave stuck state.
- [ ] Storage, download, import/export, offline, and update failures are recoverable.
- [ ] Local checks are reproducible without changing the no-build delivery model.
- [ ] Hosted PWA and physical touchscreen gates have explicit evidence.
- [ ] Feature branch is pushed and clean; `main` is untouched and unmerged.
