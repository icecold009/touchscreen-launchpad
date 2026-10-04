# Documentation verification

Snapshot: `eef62b01b9ff33d0ccf1c7fc7524eb00edf6ffbf`. Run `node docs/architecture/verify.mjs --self-test`. This validates inventory equality, graph endpoints, source targets, embedded diagrams and source-map ranges, with ten intended negative cases. These checks do not prove semantic exhaustiveness, provider, deployment or physical-device success.

No application server, provider upload or cross-device sync is part of this browser flow. Downloaded neural stem separation and procedural demo-kit modules from the older local branch are absent here; offline WAV stem rendering is an existing export feature and is distinct from source separation. Permission, codec, device, IndexedDB and offline behavior require their own browser evidence. Preview tones remain available when no sample is assigned.

## Source keys

- [S1](../../app.js)
- [S2](../../src/input-adapter.js)
- [S3](../../src/audio-lifecycle.js)
- [S4](../../src/sample-editor.js)
- [S5](../../src/effects.js)
- [S6](../../src/history.js)
- [S7](../../src/storage/indexed-db.js)
- [S8](../../src/performance-engine.js)
- [S9](../../src/midi.js)
- [S10](../../src/recording.js)
- [S11](../../app.js)
- [S12](../../sw.js)
- [S13](../../package.json)

Ranges reference complete representative modules for each subsystem dependency, not line-specific proof of every internal operation. Large module context is independently inspected using focused entry-point/dependency searches; a source map is not a full code audit.

| Arrow | Source ranges | Evidence |
|---|---|---|
| O INPUT --> UI | S2:1-41, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| O UI --> AUDIO | S1:1-4760, S3:1-23 | Current pinned source; no prior typed judgment transferred |
| O UI --> SAMPLE | S1:1-4760, S4:1-120 | Current pinned source; no prior typed judgment transferred |
| O SAMPLE --> AUDIO | S4:1-120, S3:1-23 | Current pinned source; no prior typed judgment transferred |
| O AUDIO --> EFFECT | S3:1-23, S5:1-59 | Current pinned source; no prior typed judgment transferred |
| O UI --> STATE | S1:1-4760, S6:1-62 | Current pinned source; no prior typed judgment transferred |
| O STATE --> STORE | S6:1-62, S7:1-163 | Current pinned source; no prior typed judgment transferred |
| O UI --> SEQ | S1:1-4760, S8:1-38 | Current pinned source; no prior typed judgment transferred |
| O SEQ --> AUDIO | S8:1-38, S3:1-23 | Current pinned source; no prior typed judgment transferred |
| O MIDI .-> UI | S9:1-201, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| O UI .-> MIDI | S1:1-4760, S9:1-201 | Current pinned source; no prior typed judgment transferred |
| O AUDIO --> REC | S3:1-23, S10:1-248 | Current pinned source; no prior typed judgment transferred |
| O REC --> STORE | S10:1-248, S7:1-163 | Current pinned source; no prior typed judgment transferred |
| O STATE --> EXPORT | S6:1-62, S11:1-4760 | Current pinned source; no prior typed judgment transferred |
| O SEQ --> EXPORT | S8:1-38, S11:1-4760 | Current pinned source; no prior typed judgment transferred |
| O STORE --> SAMPLE | S7:1-163, S4:1-120 | Current pinned source; no prior typed judgment transferred |
| O PWA .-> UI | S12:1-85, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| O SUPPORT .-> UI | S13:1-12, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| D INPUT --> UI | S2:1-41, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| D UI --> AUDIO | S1:1-4760, S3:1-23 | Current pinned source; no prior typed judgment transferred |
| D UI --> SAMPLE | S1:1-4760, S4:1-120 | Current pinned source; no prior typed judgment transferred |
| D SAMPLE --> AUDIO | S4:1-120, S3:1-23 | Current pinned source; no prior typed judgment transferred |
| D AUDIO --> EFFECT | S3:1-23, S5:1-59 | Current pinned source; no prior typed judgment transferred |
| D UI --> STATE | S1:1-4760, S6:1-62 | Current pinned source; no prior typed judgment transferred |
| D STATE --> STORE | S6:1-62, S7:1-163 | Current pinned source; no prior typed judgment transferred |
| D UI --> SEQ | S1:1-4760, S8:1-38 | Current pinned source; no prior typed judgment transferred |
| D SEQ --> AUDIO | S8:1-38, S3:1-23 | Current pinned source; no prior typed judgment transferred |
| D MIDI .-> UI | S9:1-201, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| D UI .-> MIDI | S1:1-4760, S9:1-201 | Current pinned source; no prior typed judgment transferred |
| D AUDIO --> REC | S3:1-23, S10:1-248 | Current pinned source; no prior typed judgment transferred |
| D REC --> STORE | S10:1-248, S7:1-163 | Current pinned source; no prior typed judgment transferred |
| D STATE --> EXPORT | S6:1-62, S11:1-4760 | Current pinned source; no prior typed judgment transferred |
| D SEQ --> EXPORT | S8:1-38, S11:1-4760 | Current pinned source; no prior typed judgment transferred |
| D STORE --> SAMPLE | S7:1-163, S4:1-120 | Current pinned source; no prior typed judgment transferred |
| D PWA .-> UI | S12:1-85, S1:1-4760 | Current pinned source; no prior typed judgment transferred |
| D SUPPORT .-> UI | S13:1-12, S1:1-4760 | Current pinned source; no prior typed judgment transferred |

Jev review receipts and actual gates are disclosed in publication.md; no model approval or production evidence is inferred.
