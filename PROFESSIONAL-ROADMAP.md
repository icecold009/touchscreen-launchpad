# Professional Launchpad roadmap

Reviewed: 2026-09-16  
Product boundary: local-first, no-build browser instrument for laptop/tablet/touchscreen performance.

This roadmap turns the researched workflow into an auditable delivery sequence:

`Record → Chop → Shape → Sequence → Perform → Export`

The current product already covers most of the performance loop. The remaining work is split into bounded packages so an apparently small control does not silently imply a timeline DAW, cloud account system, or unreliable live-audio promise.

## Capability matrix

| Area | Current state | Remaining professional gap | Priority |
| --- | --- | --- | --- |
| Pad surface | 4×4 touch, mouse, keyboard, focus, 16-color diagonal palette, fullscreen perform mode | Pressure/aftertouch gestures, optional pad velocity curves, long-session latency profiling | P1 |
| Pad playback | One-shot, loop, trigger, gate, hold, retrigger, repeat, echo, quantized launch/stop, attack/release, pitch, live-speed fallback, pan, filter | Complex high-quality time-stretch, layered/chromatic pad modes, per-pad modulation/macros | P1 |
| Voice safety | Per-pad/global voice caps, oldest-first stealing, de-click fades, choke/mute/link groups, stop-all cleanup, audio-clock lookahead, stale-timer cleanup, explicit context/device-loss handling | AudioWorklet/worker clock and long-session latency/stress profiling | P0 |
| Recording | Permission-gated microphone plus app mix, bounded local takes, IndexedDB storage, assign-to-pad, pause/resume, take rename, marker metadata, native review audio, waveform review, and PCM/WAV fallback | Optional overdub design, take-level mix editing, and device-specific recovery proof | P1 |
| Sample lab | Waveform, trim, loop region, reverse, cents pitch, live-speed fallback, pan, filter, attack/release, delay/reverb send, bounded manual slice markers, per-slice preview, and slice-to-pad assignment | Automatic transient detection, fades, normalization, zoom, batch edits, true time-stretch | P1 |
| Sample library | Shared local library, search, sort, folder import, natural ordering, deduplication, storage bounds | Drag/drop, tags/favorites, orphan cleanup, batch assignment, richer repair/preview tools | P1 |
| Arrangement | Two persistent A/B scenes, four tracks, 16 steps, swing, editable probability/micro-timing, scene duplication, reversible edits, scene playback | Scene launch quantization, scene chaining, pattern copy/duplicate beyond whole-scene duplication | P1 |
| Live effects | Per-pad delay/reverb sends, bounded master delay/reverb, filter/pan, local diagnostics, effects included in capture, master EQ/compressor/limiter, per-kit snapshots, Warmth/Space/Punch macros, and peak/headroom checks | Output/cue routing, richer metering, and device-specific calibration | P1 |
| MIDI | Optional Web MIDI input/output, learn mapping, velocity-aware input, gate/hold note-off, outbound note feedback, CC/aftertouch targets, per-kit profiles, clock-in tempo follow, clock-out transport pulses, and reconnect-safe selection | Device-specific LED color protocols, SysEx profiles, and hardware certification | P1 |
| Export | JSON layout, `.launchpack` audio backup with slice metadata, local take download, deterministic PCM/WAV take export, and two-scene MIDI | Offline rendered master/stem audio, event/performance export, import verification in a DAW | P1/P2 |
| Persistence | Local storage + IndexedDB v3, versioned pad/sample migration, five kits, user-visible pad/scene undo-redo, non-destructive slice metadata, offline PWA | Autosave checkpoints, launchpack v2 migration, conflict/repair UX | P1 |
| Accessibility | Semantic controls, keyboard/focus path, labeled step editor, live status messages, reduced-motion styling, fallback when MIDI/mic are unavailable | High-contrast/focus audit at performance distance, rate-limited announcements, screen-reader export feedback | P1 |
| Delivery | Static no-build app, Vercel canonical deployment, secondary Pages workflow, service-worker cache contract | Release smoke matrix, hosted offline/update proof after each release, device matrix, optional observability | P0 |
| Content and licensing | Local-only samples with repository licensing guidance; cleared sample preparation boundary | Starter kits with source/license manifest and no copyrighted artist recordings/stems | P1 |

## Implemented packages

These are complete on local feature branches and are intentionally stacked rather than merged into `main`:

1. Professional audio foundation: versioned migrations, transport helpers, input normalization, bounded history, voice limits, and de-click policy.
2. Record to perform: local microphone-plus-app capture, bounded takes, persistence, assignment, and permission/error states.
3. Sample lab: waveform and non-destructive region/playback shaping.
4. Performance engine: expressive modes, quantized launch/stop, groups, metronome/count-in, repeat cleanup, and fullscreen performance mode.
5. Scenes and sequencer: A/B scenes, four tracks, 16 steps, swing, probability/micro-timing data, and persistent patterns.
6. Optional Web MIDI bridge: discovery, learn mapping, velocity, release handling, output feedback, and unsupported-browser fallback.
7. Effects/master bus: delay/reverb sends and returns, recording-bus inclusion, and audio diagnostics.
8. Performance export: local take download and deterministic `.mid` export for both scenes with default/learned pad notes.
9. Sequencer authoring and reversible edits: selected-step probability/micro-timing controls, scene duplication, scene undo/redo, pad undo/redo, and kit-scoped history reset.
10. Audio clock and device resilience: audio-clock lookahead scheduling, explicit suspended/closed/unavailable diagnostics, stale sequencer-timer cleanup, and microphone device-loss handling.
11. Slice-to-pads foundation: bounded non-destructive slice metadata, editable In/Out markers, per-slice preview, slice assignment to pads, and launchpack preservation.
12. Capture review and WAV fallback: pause/resume state, take rename, local audio review, waveform rendering, marker metadata, and deterministic PCM/WAV export.
13. Master bus and performance macros: bounded EQ, compressor/limiter protection, per-kit effect snapshots, Warmth/Space/Punch macros, peak/headroom diagnostics, and capture-bus inclusion.
14. MIDI and controller depth: bounded CC/aftertouch mappings, per-kit profiles, learn cancellation/conflict feedback, clock-in tempo following, clock-out sequence pulses, reconnect-safe device selection, and note-state feedback.

Evidence boundary: local contract and rendered browser evidence are current for these packages. Physical hardware, microphone capture, DAW import, hosted production behavior, and installed-PWA behavior remain environment-specific until separately verified.

## Delivery order for the remaining work

### P0 — Make the existing features genuinely stage-safe

#### Package A: Sequencer authoring and reversible edits — complete

- Goal: expose the probability and micro-timing fields that already exist in the data model and make experimentation reversible.
- Scope: selected-step editor, keyboard-accessible step navigation, probability/micro-timing persistence, pattern copy/duplicate, user-visible undo/redo for pad and pattern edits, dirty-state reconciliation.
- Non-goals: timeline clips, piano roll, cloud collaboration.
- Acceptance: every stored sequencing field is editable without hidden gestures; undo/redo never loses samples; A/B scenes survive reload; invalid values normalize deterministically.
- Verification: contract tests, reload smoke, keyboard/focus smoke, interrupted-save rollback, mobile overflow check.
- Evidence: `npm.cmd run validate` passes 65 tests; fresh browser interaction at `http://localhost:4181/` exposed the selected-step editor, persisted 35% probability and −20% micro timing, confirmed scene undo and duplication, and restored a saved pad label with Undo pad. The browser/DAW/physical-device boundary remains unchanged.

#### Package B: Audio clock and device resilience — complete for the current browser boundary

- Goal: remove timer drift and make context/device failure recoverable during a performance.
- Scope: Audio-clock lookahead scheduling with a bounded main-thread fallback, suspend/close/unavailable recovery, input-device loss messaging, stale timer cleanup, and bounded runner tests.
- Non-goals: multichannel routing or a DAW timeline.
- Acceptance: a suspended/closed context never leaves pads or scenes falsely playing; scheduled events remain bounded; fallback is explicit and the local surface stays usable.
- Verification: audio lifecycle and clocked-runner contract tests, browser audio diagnostics smoke, scene play/stop smoke, and browser console inspection. A real 10-minute stress session, output-device switching, hosted installed-PWA behavior, and AudioWorklet/worker timing remain separate evidence or follow-up work.

#### Package C: Slice-to-pads foundation — complete for manual slicing

- Goal: turn one imported recording into playable slices without replacing the source sample.
- Scope: editable manual slice markers, bounded slice count, per-slice preview, assign selected slice to a pad, reversible slice metadata in the kit/launchpack schema, and safe handling of decoded-audio limits.
- Non-goals: automatic transient detection, complex time-warping, destructive source replacement.
- Acceptance: a source remains intact; every generated slice has a deterministic region; assignments survive export/import and storage repair.
- Verification: region/bounds tests, sample/pad migration tests, launchpack metadata contract, rendered editor smoke, and no-sample disabled-state review. Automatic transient detection, actual audio-file decoding, and microphone/device behavior remain separate evidence.

### P1 — Professional control and capture depth

#### Package D: Capture review and mix export — complete for local take review/export

- Goal: make recorded work reviewable and portable beyond a browser blob.
- Scope: take rename/delete/download polish, native audio plus waveform/duration review, timestamped markers, pause/resume where supported, pure-JS PCM/WAV encoder, and explicit codec fallback.
- Non-goals: server rendering, cloud storage, unlimited multitrack recording.
- Acceptance: a supported browser can review and rename a bounded local take, pause/resume where the recorder exposes it, add markers, export deterministic PCM WAV, and retain the source codec when decode is unavailable; a failed permission/device path preserves existing takes.
- Verification: encoder byte tests, bounded marker/session tests, MediaRecorder pause state tests, rendered capture-card smoke, mic permission/device-loss review, and download/import smoke. Actual microphone permission, codec support, and device recovery remain environment-specific.

#### Package E: Master bus and performance macros — complete for browser-local routing

- Goal: add useful polish without turning the app into a plugin host.
- Scope: bounded low/mid/high EQ, compressor and limiter safety, bounded delay/reverb feedback, per-kit master snapshots, Warmth/Space/Punch macro controls, capture-bus inclusion, and peak/headroom diagnostics.
- Non-goals: third-party plugins, arbitrary WebAssembly DSP, multichannel cue mixing.
- Acceptance: feedback and output levels remain bounded; effects can be reset; snapshots persist with the kit; macros map only to safe parameters; capture includes the selected master state; diagnostics distinguish browser limitation from source failure.
- Verification: parameter-bound and peak tests, rendered EQ/dynamics/macro/snapshot controls, audio diagnostics and level-check smoke, capture-bus review, `git diff --check`, and `npm.cmd run validate` (71 tests). Browser-local evidence is current; physical output, long-session loudness, hosted behavior, and cue-device routing remain separate.

#### Package F: MIDI and controller depth — complete for optional Web MIDI

- Goal: make optional hardware integration reliable for repeat performances without making MIDI a requirement.
- Scope: bounded CC/aftertouch mappings for master volume, tempo, and master macros; per-kit MIDI profiles; learn cancellation and note/controller conflict feedback; clock-in tempo following; clock-out start/clock/stop pulses tied to sequence transport; reconnect-safe input/output selection; and generic note-state feedback for controller LEDs where exposed.
- Non-goals: SysEx scripts for every controller, vendor-specific RGB protocols, multichannel hardware routing, automatic DAW control, or hardware certification.
- Acceptance: browsers without Web MIDI retain full local operation; learned pad/controller mappings and clock policy persist with the kit and launchpack; duplicate mappings are surfaced instead of silently stealing a control; disconnect/reconnect does not leave gate state or clock timers stuck; outbound feedback remains bounded and errors degrade to a visible reconnect state.
- Verification: MIDI parser/profile/controller/clock contract tests, module/cache/DOM contracts, fresh browser fallback smoke, learn-cancel smoke, and console inspection. Physical controller matrix, MIDI permission success, device LEDs, long-session clock drift, hosted behavior, and DAW sync remain environment-specific.

#### Package F: MIDI and controller depth

- Goal: make optional hardware integration reliable for repeat performances.
- Scope: CC/aftertouch mapping, clock in/out decision, controller profiles, reconnect behavior, pad LED feedback where exposed, learn cancellation and conflict UI.
- Non-goals: SysEx scripts for every controller, hardware-specific guarantees, MIDI becoming a requirement.
- Acceptance: no-MIDI browsers retain full local operation; learned mappings are bounded and portable; disconnect/reconnect cannot leave a gate stuck.
- Verification: fake Web MIDI access tests, permission denial, hot-plug/reconnect, controller matrix on available hardware.

#### Package G: Sample library and content polish

- Goal: reduce friction between a sample folder and a playable kit.
- Scope: drag/drop, tags/favorites, batch assignment, orphan detection/repair, waveform zoom/fades/normalization, starter-kit license manifest.
- Non-goals: copyrighted artist audio, server indexing, unbounded sample storage.
- Acceptance: all batch actions are previewable or reversible; licensing metadata ships with any starter content; limits are shown before persistence.
- Verification: import/storage quota tests, repair/reset tests, accessibility/overflow smoke, source/license audit.

### P2 — Portable production workflows

#### Package H: Rendered audio and event export

- Goal: bridge the gap between browser performance and production software.
- Scope: deterministic offline WAV render, master plus per-track stems, event/performance log export, render progress/cancel state, file-size/memory guardrails, post-export checksum.
- Non-goals: live cloud rendering, project files for every DAW, unlimited track counts.
- Acceptance: master/stems match the selected scene and tempo; cancellation leaves no corrupt download; a render can be repeated byte-for-byte under the same inputs.
- Verification: golden PCM tests, memory stress, large-kit tests, import checks in at least one DAW when available.

#### Package I: Scene launch and arrangement polish

- Goal: make A/B scenes behave like a live arrangement tool without becoming a timeline editor.
- Scope: quantized scene switching, pattern copy/duplicate, scene names, chain/list of scenes, launch-state feedback, safe stop/transition rules.
- Non-goals: piano roll, arbitrary timeline automation, multitrack recording.
- Acceptance: scene transitions land on the selected grid; no double scheduling or orphaned voices; scene changes persist and remain keyboard accessible.
- Verification: transport/runner tests, timing tolerance tests, stop-all stress, rendered transition smoke.

## Deliberately deferred unless the product boundary changes

- Cloud accounts, sync, share links, collaboration, remote sample hosting, and analytics tied to user content.
- Full timeline DAW, piano roll, audio warping, elastic time, multichannel routing, headphone cue buses, and arbitrary plugin hosting.
- Native mobile packaging and background audio guarantees beyond browser/PWA behavior.
- Artist recordings, stems, or proprietary sample packs. Use cleared or user-provided source material only.

## Package gate and evidence rules

Every future package must state its goal, scope, non-goals, files, tests, acceptance criteria, and evidence. The minimum gate is:

1. Work only on a dedicated feature branch; preserve unrelated dirty files.
2. Run `npm.cmd run validate` and `git diff --check`.
3. Perform a fresh rendered-browser smoke at desktop and narrow viewport where layout changes exist.
4. Separate local, browser, hosted, installed-PWA, physical-device, provider, and DAW evidence.
5. Update this roadmap and `TODO.md` with shipped scope and remaining limits.
6. Stop for independent review before merging or publishing; `main` is a separate approval gate.

## Definition of done for the professional milestone

The milestone is complete when Packages A–G are shipped and verified, Package H has deterministic master/stem export or an explicit user-approved deferral, the production smoke matrix is green, and the remaining deferred list is accepted as a product decision rather than an accidental omission.
