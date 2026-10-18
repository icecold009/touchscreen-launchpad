# Source coverage register

Snapshot: `eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf`. Current hosted source; previous local snapshot `3ba22223efbaffe21deaaae65d6ffe0fd85bb78c` is historical.

```mermaid
%% Source reviewed against hosted snapshot eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf
%%{init: {"theme":"base","securityLevel":"loose","fontFamily":"Arial, sans-serif","themeVariables":{"background":"#0b1220","primaryColor":"#17283d","primaryTextColor":"#edf4ff","primaryBorderColor":"#71c4ec","lineColor":"#9fadc1","secondaryColor":"#213548","tertiaryColor":"#17283d","edgeLabelBackground":"#0b1220","clusterBkg":"#101d2e","clusterBorder":"#456783","fontSize":"17px"},"flowchart":{"htmlLabels":true,"curve":"linear","nodeSpacing":35,"rankSpacing":50}}}%%
flowchart TB
  UI["Pad surface and app controller"]
  INPUT["Pointer, keyboard and accessible input"]
  AUDIO["Audio lifecycle and voice registry"]
  SAMPLE["Library, waveform editing and slicing"]
  EFFECT["Effects and master processing"]
  STATE["Kits, layout and history"]
  STORE["IndexedDB and local recovery"]
  SEQ["Scenes, audio-clock sequence and arrangements"]
  MIDI["Optional Web MIDI bindings and clock"]
  REC["Microphone and performance takes"]
  EXPORT["Portable packs, MIDI and offline WAV export"]
  PWA["Service worker and offline shell"]
  SUPPORT["Tests, licensing, assets and delivery configuration"]
  INPUT --> UI
  UI --> AUDIO
  UI --> SAMPLE
  SAMPLE --> AUDIO
  AUDIO --> EFFECT
  UI --> STATE
  STATE --> STORE
  UI --> SEQ
  SEQ --> AUDIO
  MIDI -. optional device input .-> UI
  UI -. optional device output .-> MIDI
  AUDIO --> REC
  REC --> STORE
  STATE --> EXPORT
  SEQ --> EXPORT
  STORE --> SAMPLE
  PWA -. offline shell .-> UI
  SUPPORT -. supports .-> UI
  click UI "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/app.js" "Open source"
  click INPUT "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/input-adapter.js" "Open source"
  click AUDIO "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/audio-lifecycle.js" "Open source"
  click SAMPLE "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/sample-editor.js" "Open source"
  click EFFECT "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/effects.js" "Open source"
  click STATE "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/history.js" "Open source"
  click STORE "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/storage/indexed-db.js" "Open source"
  click SEQ "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/performance-engine.js" "Open source"
  click MIDI "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/midi.js" "Open source"
  click REC "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/src/recording.js" "Open source"
  click EXPORT "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/app.js" "Open source"
  click PWA "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/sw.js" "Open source"
  click SUPPORT "https://github.com/icecold009/touchscreen-launchpad/blob/eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf/package.json" "Open source"
```

## File accounting

70 tracked paths, assigned exactly once. Runtime clusters, tests, schema, assets and configuration are explicitly listed. This does not prove every execution path or dynamically loaded service.

### Assets, entry points and configuration

- `.github/workflows/pages.yml`
- `.gitignore`
- `CONTENT-LICENSES.md`
- `PROFESSIONAL-ROADMAP.md`
- `README.md`
- `TODO.md`
- `app.js`
- `icon.svg`
- `index.html`
- `manifest.webmanifest`
- `package-lock.json`
- `package.json`
- `robots.txt`
- `samples/.gitkeep`
- `samples/README.md`
- `scripts/validate-site.mjs`
- `sitemap.xml`
- `style.css`
- `sw.js`

### Documentation

- `docs/architecture/touchscreen-launchpad.mmd`
- `docs/architecture/touchscreen-launchpad.png`

### Runtime modules

- `src/arrangement.js`
- `src/audio-lifecycle.js`
- `src/bootstrap.js`
- `src/clocked-sequencer.js`
- `src/download.js`
- `src/effects.js`
- `src/history.js`
- `src/input-adapter.js`
- `src/midi-file.js`
- `src/midi.js`
- `src/migrations.js`
- `src/performance-engine.js`
- `src/performance-export.js`
- `src/pointer-state.js`
- `src/recording.js`
- `src/sample-editor.js`
- `src/sample-library.js`
- `src/sequencer.js`
- `src/slices.js`
- `src/storage-request.js`
- `src/storage/indexed-db.js`
- `src/storage/local-settings.js`
- `src/transport.js`
- `src/voice-registry.js`
- `src/wav.js`

### Tests

- `test/arrangement.test.mjs`
- `test/audio-lifecycle.test.mjs`
- `test/effects.test.mjs`
- `test/fixtures/storage-contract.mjs`
- `test/foundation.test.mjs`
- `test/import-export.test.mjs`
- `test/kit-library.test.mjs`
- `test/midi-file.test.mjs`
- `test/midi.test.mjs`
- `test/module-contract.test.mjs`
- `test/performance-engine.test.mjs`
- `test/performance-export.test.mjs`
- `test/pointer-lifecycle.test.mjs`
- `test/pwa.test.mjs`
- `test/recording.test.mjs`
- `test/sample-editor.test.mjs`
- `test/sample-library.test.mjs`
- `test/sequencer.test.mjs`
- `test/service-worker-runtime.test.mjs`
- `test/site-dom.test.mjs`
- `test/slices.test.mjs`
- `test/storage-recovery.test.mjs`
- `test/storage-repository.test.mjs`
- `test/wav.test.mjs`
