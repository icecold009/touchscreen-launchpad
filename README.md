# Touchscreen Launchpad

Touchscreen Launchpad is a local-first browser instrument for triggering samples and loops from a laptop, tablet, or touchscreen device. It is designed to feel immediate: touch, mouse, keyboard, and accessible focus controls all reach the same pad interaction, while audio files stay in the current browser.

The feature-by-feature delivery plan, acceptance criteria, and explicit deferred boundaries live in [PROFESSIONAL-ROADMAP.md](PROFESSIONAL-ROADMAP.md).

## What it supports

- Responsive 4×4 pad grid with touch, mouse, keyboard, and focus states.
- WAV, MP3, OGG, M4A, AAC, and FLAC sample loading.
- One-shot and loop playback with per-pad volume.
- Optional BPM quantisation for loop starts and stops.
- Stop-all, master volume, and tempo controls.
- Pad names, shortcuts, colours, and playback modes.
- Five reusable named kits with instant switching, duplicate/delete/rename controls, and a shared local sample library.
- Versioned layout persistence in local storage with JSON v2 export and v1/v2 import compatibility.
- Sample persistence in IndexedDB; audio files never leave the browser.
- Folder or multi-file audio import with natural ordering, first-16 pad mapping, SHA-256 deduplication, and extra-library retention.
- Sample-library drag/drop, favorites, bounded tags, tag-aware search/filtering, usage/orphan visibility, bounded batch assignment, and confirmed unused-sample cleanup.
- Portable `.launchpack` backup/restore containing all five kit definitions and their referenced audio, with validation and transactional rollback.
- Local performance capture with microphone-plus-app mix, saved takes, take assignment, and direct take download.
- Take review with pause/resume, waveform/duration display, timestamped markers, rename, and deterministic PCM/WAV export when the browser can decode the source codec.
- Waveform/sample shaping with trim, loop regions, reverse, pitch, live-speed fallback, pan, filter, envelope, and per-pad delay/reverb sends.
- Master low/mid/high EQ, compressor/limiter protection, per-kit effect snapshots, Warmth/Space/Punch macros, and peak/headroom diagnostics.
- Non-destructive sample slicing with up to 16 editable markers, per-slice preview, and assignment to any pad.
- Waveform zoom, bounded fade-in/fade-out shaping, and optional normalize-on-playback are saved with the selected pad.
- Four-track A/B scenes with swing, probability, micro-timing, repeat scheduling, fullscreen performance mode, beat/bar-quantized launches, persistent names, bounded chain playback, and deterministic MIDI export.
- Selected-step probability/micro-timing editing, scene duplication, and user-visible pad/scene undo-redo.
- Audio-clock lookahead sequencing with explicit suspended/closed diagnostics, stale-timer cleanup, and microphone device-loss handling.
- Optional Web MIDI input/output with learned pad mappings, velocity-aware triggering, CC/aftertouch targets, per-kit profiles, clock policy, reconnect handling, and generic note-state feedback.
- Deterministic scene event-log export plus bounded offline master/stem WAV render with master EQ/dynamics and post-export checksum reporting when `OfflineAudioContext` is available.
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

## Browser architecture and persistence

The application is a browser-only, local-first static site. The browser entry point is [`index.html`](index.html), which loads [`src/bootstrap.js`](src/bootstrap.js). Bootstrap catches startup failures; [`app.js`](app.js) then coordinates the pad UI, input adapters, Web Audio playback, kit state, persistence, and import/export. There is no application server in this flow, and downloaded WAV packs are user-selected input rather than source-code or repository assets.

### Runtime path

The main interaction path is:

`touch / mouse / keyboard → 4×4 pad UI → input adapter → app controller → audio and sample services → Web Audio voices`

`index.html` renders the 16-pad surface. [`src/input-adapter.js`](src/input-adapter.js) normalizes pointer, keyboard, and other input into pad actions. [`src/audio-lifecycle.js`](src/audio-lifecycle.js), [`src/voice-registry.js`](src/voice-registry.js), [`src/sample-editor.js`](src/sample-editor.js), [`src/sample-library.js`](src/sample-library.js), and [`src/effects.js`](src/effects.js) cover audio readiness, voice cleanup, sample lookup/editing, and processing. A preview tone remains available when a pad has no assigned sample.

The persistence boundary is implemented in [`app.js`](app.js), with request/transaction failure handling in [`src/storage-request.js`](src/storage-request.js) and record normalization in [`src/migrations.js`](src/migrations.js). The import and export handlers remain in [`app.js`](app.js), with focused contracts in [`test/import-export.test.mjs`](test/import-export.test.mjs) and [`test/kit-library.test.mjs`](test/kit-library.test.mjs).

### What survives a reload

- **IndexedDB blobs and records.** The database is `touchscreen-launchpad`, currently at `DATABASE_VERSION = 3` in [`app.js`](app.js). Its `samples` store keeps audio `Blob`s plus hashes and library metadata; `kits` stores the five kit records and their 16-pad assignments; `takes` stores local performance recordings; and `history` is reserved for persisted history records. Audio files remain in this browser and are not uploaded.
- **localStorage layout state.** The key `touchscreen-launchpad.layout.v1` stores the active pad layout as a version-2 JSON payload. `touchscreen-launchpad.current-kit.v1` remembers the selected kit, while `touchscreen-launchpad.kits-mirror.v1` is a small compatibility metadata mirror. IndexedDB kit records are canonical when available; the mirror is not a sync service.
- **Active-pad layout is not the sample library.** The active layout is the currently displayed 16-pad arrangement: names, shortcuts, playback settings, effects, and `sampleId` references. A kit record is a named reusable snapshot of that arrangement. The shared sample library owns the actual audio blobs and metadata, so several kits can refer to the same sample without duplicating its bytes.

The local browser boundary is intentional: persistence survives reload in the same browser profile/device, but it does not provide account storage, cloud backup, or cross-device synchronization.

### Import, export, and recovery

- **Layout JSON** exports pad assignments and settings only. Version 1 and version 2 imports are accepted, and an import reports sample IDs that are not present in this browser rather than pretending it restored their audio.
- **Audio import** accepts one file, a folder, or multiple files. Files are natural-sorted, SHA-256 deduplicated, and the first 16 map to pads; additional files stay in the shared library. The current limits are 128 samples, 50 MB per file, and 512 MB of logical sample storage.
- **`.launchpack` backup/restore** includes the five kit definitions and their referenced audio bytes. It validates paths, hashes, IDs, counts, sizes, and pad references before a transactional write; existing samples are reused by content hash and imported IDs are remapped. This is a portable local backup, not an upload or sync protocol.
- **Recovery paths** are visible in the status UI. IndexedDB or localStorage failure falls back to memory-only operation with a reload warning; quota errors recommend exporting before freeing storage; corrupt or over-limit samples expose repair/reset actions; failed layout or audio imports roll back the in-memory layout and preserve the existing kit where possible.

### Offline and PWA boundary

[`sw.js`](sw.js) caches the relative application shell at cache version `touchscreen-launchpad-v59`, including the browser module graph, manifest, and icon. Its offline fallback is navigation-only: it serves a cached document shell when a navigation cannot reach the network, while ordinary asset requests use the cache or network. [`manifest.webmanifest`](manifest.webmanifest) declares the relative `./` start URL and scope for installable project hosting. A new service-worker controller reports the update and reloads the page; HTTP or HTTPS is required for service-worker, IndexedDB, and installable-PWA behavior.

The diagram was generated from the public default branch with [GitDiagram](https://gitdiagram.com/icecold009/touchscreen-launchpad) using the exact repository URL [`https://github.com/icecold009/touchscreen-launchpad`](https://github.com/icecold009/touchscreen-launchpad):

- [PNG architecture diagram](docs/architecture/touchscreen-launchpad.png)
- [Mermaid source](docs/architecture/touchscreen-launchpad.mmd)
- [Portfolio project page](https://shauryasaria.me/projects?project=touchscreen-launchpad)

GitDiagram's `Browser Stores` node represents the IndexedDB stores and localStorage keys described above. The diagram intentionally has no server, provider, or cross-device-sync component.

The focused contracts are [`test/import-export.test.mjs`](test/import-export.test.mjs), [`test/kit-library.test.mjs`](test/kit-library.test.mjs), [`test/storage-recovery.test.mjs`](test/storage-recovery.test.mjs), and [`test/pwa.test.mjs`](test/pwa.test.mjs); the static module/PWA graph is checked by [`scripts/validate-site.mjs`](scripts/validate-site.mjs) through [`package.json`](package.json).

## Use the launchpad

1. Select a pad.
2. Edit its name, shortcut, playback mode, and volume.
3. Choose an audio file and save the pad. To reuse a file already in the shared library, select **Assign** beside it, then save the pad.
4. Trigger it by touch, mouse, or the displayed keyboard shortcut.
5. Use **Save kit** for an explicit local save, or switch among the five named kit slots.
6. Use **Export .launchpack** for a portable backup of all kits and referenced audio. **Import Pack** accepts a folder or multiple audio files; the first 16 natural-sorted files map to pads and any remaining files stay in the shared library.
7. Record a local take, assign it to a pad, or download it. In Sample lab, create a bounded slice bank, adjust In/Out markers, preview a slice, and assign it to the selected pad before saving. Build Scene A/B patterns, export a deterministic event log or bounded master/stems WAV, and use **Export MIDI** to move the arrangement into a DAW or hardware sequencer.

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

Cloud accounts, sync, complex time-stretching, automatic slicing, richer offline delay/reverb return rendering, more-than-two-scene arrangements, full timeline sequencing, DAW import verification, and native mobile packaging remain deferred. Scene MIDI, event-log, guarded WAV export, and bounded A/B chain playback are available; audio capture and device access stay permission-gated and browser-local.
