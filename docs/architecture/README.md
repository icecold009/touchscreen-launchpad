# Touchscreen Launchpad architecture

Browser inputs drive Web Audio pads, reusable local kits, sequencing, MIDI, recording and portable exports.

Snapshot: `eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf`, verified through the GitHub connector on 2026-10-04.

```mermaid
%% Source reviewed against hosted snapshot eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf
%%{init: {"theme":"base","securityLevel":"loose","fontFamily":"Arial, sans-serif","themeVariables":{"background":"#0b1220","primaryColor":"#17283d","primaryTextColor":"#edf4ff","primaryBorderColor":"#71c4ec","lineColor":"#9fadc1","secondaryColor":"#213548","tertiaryColor":"#17283d","edgeLabelBackground":"#0b1220","clusterBkg":"#101d2e","clusterBorder":"#456783","fontSize":"17px"},"flowchart":{"htmlLabels":true,"curve":"linear","nodeSpacing":35,"rankSpacing":50}}}%%
flowchart TD
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

## Boundaries and source differences

No application server, provider upload or cross-device sync is part of this browser flow. Downloaded neural stem separation and procedural demo-kit modules from the older local branch are absent here; offline WAV stem rendering is an existing export feature and is distinct from source separation. Permission, codec, device, IndexedDB and offline behavior require their own browser evidence. Preview tones remain available when no sample is assigned.

The [complete coverage register](coverage.md), [editable detailed diagram](detail.mmd) and [verification source map](verification.md) account for the pinned source. No application behavior, dependency, data or deployment changes are proposed. Prior local-only diagrams and Jev judgments are historical and are not transferred as approval of this snapshot.
