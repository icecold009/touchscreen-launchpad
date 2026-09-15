# Touchscreen Launchpad

Touchscreen Launchpad is a local-first browser instrument for triggering samples and loops from a laptop, tablet, or touchscreen device. It is designed to feel immediate: touch, mouse, keyboard, and accessible focus controls all reach the same pad interaction, while audio files stay in the current browser.

## What it supports

- Responsive 4×4 pad grid with touch, mouse, keyboard, and focus states.
- WAV, MP3, OGG, M4A, AAC, and FLAC sample loading.
- One-shot and loop playback with per-pad volume.
- Optional BPM quantisation for loop starts and stops.
- Stop-all, master volume, and tempo controls.
- Pad names, shortcuts, colours, and playback modes.
- Five reusable named kits with instant switching, duplicate/delete/rename controls, and a shared local sample library.
- Layout persistence in local storage with JSON import/export.
- Sample persistence in IndexedDB; audio files never leave the browser.
- Folder or multi-file audio import with natural ordering, first-16 pad mapping, SHA-256 deduplication, and extra-library retention.
- Portable `.launchpack` backup/restore containing all five kit definitions and their referenced audio, with validation and transactional rollback.
- Offline application shell through a service worker.
- Preview tones for pads without an assigned sample.

## Run locally

There is no build step or dependency install. Serve the repository over HTTP so service-worker, IndexedDB, and installable-PWA behavior can run:

```bash
python -m http.server 4173
```

Open <http://localhost:4173> in a modern browser. Opening `index.html` directly is enough for a basic interaction check, but HTTP or HTTPS is required for offline installation and full persistence behavior.

## Verify locally

The repository includes a no-build verification contract. From a clean checkout, run:

```bash
npm ci
npm run validate
```

This checks application and service-worker syntax, required static assets and PWA references, and the primary DOM contract. It does not replace rendered browser or physical touchscreen evidence.

## Use the launchpad

1. Select a pad.
2. Edit its name, shortcut, playback mode, and volume.
3. Choose an audio file and save the pad.
4. Trigger it by touch, mouse, or the displayed keyboard shortcut.
5. Use **Save kit** for an explicit local save, or switch among the five named kit slots.
6. Use **Export .launchpack** for a portable backup of all kits and referenced audio. **Import Pack** accepts a folder or multiple audio files; the first 16 natural-sorted files map to pads and any remaining files stay in the shared library.

Exported JSON contains pad assignments and settings, not audio bytes. An imported layout may therefore show missing samples until those files are assigned again in the current browser. `.launchpack` backups include the referenced audio bytes and never upload them to the hosted app.

The local library allows approximately 128 samples and 512 MB total storage. Individual files remain capped at 50 MB, and decoded-audio safety limits still apply during playback.

## Published demo

The canonical personal demo is <https://touchscreen-launchpad.vercel.app/>. It is a static production deployment on Vercel and does not require DNS changes or access to the portfolio domain. The deployment is local-first: sample audio is stored in each visitor’s browser and is never uploaded to Vercel.

The repository also retains the no-build GitHub Pages workflow at `.github/workflows/pages.yml` as a reproducible secondary deployment path. Its project URL is not the canonical demo because the account-level `icecold009.github.io` Pages site uses the portfolio custom domain and redirects project requests. Use the Vercel URL above for hosted verification.

## Project structure

```text
app.js                 Pointer, keyboard, audio, kit, storage, and export logic
src/bootstrap.js       Browser entrypoint and startup error boundary
src/pointer-state.js   Testable pointer ownership and interruption bookkeeping
src/storage-request.js Testable IndexedDB request and transaction failure bridge
src/download.js        Testable delayed text-download lifecycle
index.html              Application shell
manifest.webmanifest    Install metadata
style.css               Responsive and reduced-motion styling
sw.js                   Offline application shell
samples/                Licensing note and sample placeholder
```

## Sample licensing

Only load audio you created or have permission to use. Do not commit or redistribute copyrighted samples in this repository.

## Deliberate limits

Cloud accounts, sync, microphone recording, MIDI hardware, time-stretching, slicing, effects, timeline sequencing, DAW export, and native mobile packaging remain deferred until the local interaction and offline workflow have been validated on target devices.
