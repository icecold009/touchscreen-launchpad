# Touchscreen Launchpad

Touchscreen Launchpad is a local-first browser instrument for triggering samples and loops from a laptop, tablet, or touchscreen device. It is designed to feel immediate: touch, mouse, keyboard, and accessible focus controls all reach the same pad interaction, while audio files stay in the current browser.

## What it supports

- Responsive 4×4 pad grid with touch, mouse, keyboard, and focus states.
- WAV, MP3, OGG, M4A, AAC, and FLAC sample loading.
- One-shot and loop playback with per-pad volume.
- Optional BPM quantisation for loop starts and stops.
- Stop-all, master volume, and tempo controls.
- Pad names, shortcuts, colours, and playback modes.
- Layout persistence in local storage with JSON import/export.
- Sample persistence in IndexedDB; audio files never leave the browser.
- Offline application shell through a service worker.
- Preview tones for pads without an assigned sample.

## Run locally

There is no build step or dependency install. Serve the repository over HTTP so service-worker, IndexedDB, and installable-PWA behavior can run:

```bash
python -m http.server 4173
```

Open <http://localhost:4173> in a modern browser. Opening `index.html` directly is enough for a basic interaction check, but HTTP or HTTPS is required for offline installation and full persistence behavior.

## Use the launchpad

1. Select a pad.
2. Edit its name, shortcut, playback mode, and volume.
3. Choose an audio file and save the pad.
4. Trigger it by touch, mouse, or the displayed keyboard shortcut.
5. Use **Save layout** for an explicit local save or **Export JSON** for a portable layout definition.

Exported JSON contains pad assignments and settings, not audio bytes. An imported layout may therefore show missing samples until those files are assigned again in the current browser.

## Publish with GitHub Pages

The repository uses a no-build workflow at `.github/workflows/pages.yml`. Enable **Settings → Pages → GitHub Actions**, then use the Actions tab for a manual run or merge the reviewed feature branch into `main`.

Expected project URL: <https://icecold009.github.io/touchscreen-launchpad/>

The hosted site remains local-first. Sample audio is stored in each visitor’s browser and is never uploaded to GitHub Pages.

## Project structure

```text
app.js                 Pointer, keyboard, audio, storage, and export logic
index.html              Application shell
manifest.webmanifest    Install metadata
style.css               Responsive and reduced-motion styling
sw.js                   Offline application shell
samples/                Licensing note and sample placeholder
```

## Sample licensing

Only load audio you created or have permission to use. Do not commit or redistribute copyrighted samples in this repository.

## Deliberate limits

Cloud accounts, shared layouts, MIDI, DAW export, and native mobile packaging are deferred until the local interaction and offline workflow have been validated on target devices.

