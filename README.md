# Touchscreen Launchpad

A local-first browser launchpad for triggering samples and loops from a laptop or touchscreen device.

## MVP features

- Responsive 4x4 pad grid with touch, mouse, keyboard, and accessible focus controls
- Local WAV, MP3, OGG, M4A, AAC, and FLAC sample loading
- One-shot and loop playback with per-pad volume
- Optional BPM quantization for loop starts and stops
- Stop-all control, master volume, and tempo control
- Pad names, keyboard shortcuts, colors, and playback modes
- Layout persistence in local storage and JSON import/export
- Sample persistence in IndexedDB; audio files never leave the browser
- Installable offline application shell through a service worker
- Preview tones for pads without an assigned sample

## Run locally

The app has no build step or dependency install. Serve the repository over HTTP so the service worker can run:

```bash
python -m http.server 4173
```

Open <http://localhost:4173> in a modern browser such as Chrome or Edge. Opening `index.html` directly also supports the basic launchpad, but offline installation and persistence require HTTP or HTTPS.

## Publish with GitHub Pages

The repository includes a no-build GitHub Actions workflow at `.github/workflows/pages.yml`. It validates the app on pull requests and deploys pushes from `codex/launchpad-mvp` or `main`.

For the first deployment, open the repository's **Settings → Pages** screen and select **GitHub Actions** as the source. The expected public project URL is <https://icecold009.github.io/touchscreen-launchpad/>. The workflow also supports manual runs from the Actions tab.

The hosted site remains local-first: sample audio is stored in each visitor's browser and is never uploaded to GitHub Pages.

## Use the launchpad

1. Select a pad in the grid.
2. Edit its name, shortcut, playback mode, and volume.
3. Choose an audio file, then save the pad.
4. Trigger the pad by touch, mouse, or its displayed keyboard shortcut.
5. Use `Save layout` for an explicit local save or `Export JSON` for a portable layout definition.

Sample files are stored locally in IndexedDB. Exported JSON contains pad assignments and settings, but not the audio bytes; imported layouts may therefore show missing samples until they are assigned again in the current browser.

## Sample licensing

Only load audio you created or have permission to use. Do not commit or redistribute copyrighted samples in the repository.

## Project structure

```text
.
├── app.js
├── index.html
├── manifest.webmanifest
├── style.css
├── sw.js
└── samples/
    ├── README.md
    └── .gitkeep
```

## Scope after the MVP

Cloud accounts, shared layouts, MIDI, DAW export, and native mobile packaging are intentionally deferred until the local workflow is validated.
