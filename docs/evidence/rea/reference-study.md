# REA reference study: pad editing and performance states

## Target and capture

- Target: **Skunk Sampler — Skunk Audio**, `https://skunkaudio.org/play`, selected from the authorized browser targets returned by REA.
- Variant: browser sampler. The page describes the Android app as the “real app”; these observations do not establish native Android or Ableton Live behavior.
- Version: no application version was exposed in the inspected page. Capture date: **2026-10-16**. Browser: Chrome 155.0.8059.80.
- Ableton Live was checked for installation and was unavailable. No commercial software was downloaded or purchased.
- REA 6.5.0 was configured for Codex after a read-only setup preview. Existing Codex config content was preserved and a `.rea.backup` was created. Codex needs a restart/reconnect before the registered tools appear in its normal tool roster. For this task, a direct `rea --mcp` session was used; initialize, tools/list (207 tools), and a real `list_browser_targets` call succeeded. Optional native providers were unavailable, so no native-app analysis was attempted.

## REA operations and receipts

All files in this directory were produced for this task. PNGs are extracted from REA screenshot artifacts; JSON receipts retain operation parameters, evidence IDs, browser identity, and limitations.

- `reference-target-list.json` — `list_browser_targets`, evidence `ev_3aedb1169d4f58e14a5b0e2ed19d28034473e8dc0b83213d6b9b3754a7c2e6f4`.
- `reference-inspection.json` — `inspect_web_page`, evidence `ev_50cd32180236b0eb2008ec188aa96ca45fece0f30e68b116a8302fc160308f0d`.
- `reference-screenshot-evidence.json`, `reference-performance.png` — `capture_web_screenshot`, evidence `ev_057d4b9e976a0b3e7911ecdd5b8e392bb8c4163c22f67e203fe39b57d2349d3e`.
- `reference-sampler-workflow.json` and the `reference-perform-start.png`, `reference-pad-audition.png`, `reference-sample-editor.png`, and `reference-perform-return.png` captures — `capture_browser_scenario`, evidence `ev_17a3c64534984ff7478c9f7f1a1b86a701e734084669b4f65aa2559d4440df22`.
- `reference-assignment-flow.json`, `reference-source-tab.png` — `capture_browser_scenario`, evidence `ev_1ac54c3705dddc28198933b5a7eb7256aeb303a618ff71c07ed10ed541ef2682`.
- `reference-sequence-workflow.json` — `capture_browser_scenario`, evidence `ev_bab613dc3f8b2872ff2edd400517bcdc2f67ef96c701840b31a84ce9df115770`.
- `reference-observe-sequence.json` — `observe_web_session`, evidence `ev_69f470a7939ba7c6533fe24aa24633198777694706ff4bdaae6ebd0a25266447`; REA attached after initial navigation and collected only navigation metadata.
- `reference-transport-states.input.json`, `reference-transport-states.receipt.json` — `capture_browser_scenario`, evidence `ev_a76dc36c2db438d1c3b43856ea89969198c578a04066d07cdb577ba024964934`.
- `reference-bundle-assignment.json` — `analyze_web_bundle`, evidence `ev_31dbb1ee0723a89f499dd803bf3906432be6f04bb9099b1926a353edf6243dbb`. Three scripts parsed, no inferences returned. It did not establish the assignment mechanism; no mechanism claim below relies on it.
- `launchpad-baseline-inspection.json`, `launchpad-baseline-screenshot.json`, `launchpad-baseline.png` — baseline `inspect_web_page` and `capture_web_screenshot`, evidence `ev_3e18c4f52bd8c5a966f1f923ffc0c7453411c04d2e386e4ac07ec36d556cd8e6` and `ev_eee9e4a543c06ccca877ef529a43e252b292af051b981df599b588c6e252a2a7`, 1586×836.
- `launchpad-after-rea-screenshot.json`, `launchpad-after-rea.png` — after `capture_web_screenshot`, evidence `ev_e8816f15e66492c416be41637326b9d498d6128351f518eeb01caf1ec322ac30`, same Chrome target and viewport.
- `launchpad-before.artifact.json`, `launchpad-after.artifact.json`, `launchpad-visual-comparison.json` — `compare_web_screenshots`, evidence `ev_9203dd1d99c6c00b8173a5d2dfa1ef100a64617d1a8a20a6346d7cb3f9a46d8f`.

## Observations

1. In the browser performance view, `KICK` is labeled as the selected pad, a KICK pad button can be auditioned, and an `EDIT PAD` control opens the pad editor. The workflow tabs are `01 PERFORM`, `02 SEQUENCE`, and `03 SAMPLE EDIT`.
2. The PAD editor exposes the selected context `A1 · KICK`, then buttons `PREVIEW`, `APPLY`, and `REVERT`. Its text says edits apply to the selected pad and are heard in the sequencer and export. Returning to `01 PERFORM` retained KICK as selected.
3. The SOURCE tab offers device file, direct link, microphone, and browser-tab recording sources. Its captured screenshot does not show the selected destination pad. No file was loaded, no microphone/browser-tab recording was started, and Apply/Revert was not activated.
4. The performance view exposes `Play`, `Stop`, and `Loop bar 1`; REA recorded the loop control as `[pressed]` after activation. A `Play KICK` button provides pad audition. The captured screen uses a selected-pad label/appearance; an active-playback marker was not reliably captured in these static states.
5. The sequence screen exposes step buttons for the kit pads. The sampled workflow did not reveal a pending pad/scene launch or a launch-quantization state.

## Inferences and unknowns

- **Inference:** A visible selected-pad identity is the reference’s primary editor association, and the three named workflow tabs offer a direct route back to performance. The observed return retained the same selection.
- **Inference:** The text and `APPLY`/`REVERT` controls suggest edits are staged before application. This was not verified by modifying or applying a sound.
- **Unknown:** Exact behavior/timing of active playback and pending launches; no queued launch was captured. `Loop bar 1` is demonstrably a pressed transport control, but its timing rules were not investigated.
- **Unknown:** Native Ableton Live, Android behavior, installed app version, device/touch input, provider-side audio permissions, and live microphone/recording paths.

## Mapping adopted for Launchpad

| REA finding | Current Launchpad | Change adopted | Acceptance check |
|---|---|---|---|
| PAD editor shows `A1 · KICK`; return preserves selection | Editor showed a pad number, generic heading, and the chosen sample name separately | Show pad number plus custom name next to the editor and assignment surface | Select another pad and confirm both labels update; open/close editor without losing selection |
| Source view omits visible destination; Apply/Revert are explicit | Single sample assignment already stages until `Save pad`; global status names the pad; batch saves immediately | Keep target visible; show staged replacement destination and Save-pad outcome; preview batch pad range before saving | Stage a sample and confirm destination/result; batch preview and committed result use the same bounded range |
| Separate pad audition, selection, playback-mode and transport controls | Selected, playing, queued, and loading states exist, but labels did not expose state and active CSS could replace selection ring | Add compact EDIT/PLAY/QUEUE/LOAD badge, detailed accessible state label, and combined selected+active rings; retain existing loop badge | Run keyboard and browser interaction checks for selected, playing, queued/loading and loop states; no trigger semantics change |
| No pending launch state was observed | Launchpad already has queued playback and scene launch states | Rejected any new launch model or audio-clock behavior | Existing code paths and scheduling remain unchanged |

## Local screenshot comparison

`launchpad-baseline-screenshot.json` and `launchpad-baseline.png` are the REA capture before implementation. `launchpad-after-rea-screenshot.json` and `launchpad-after-rea.png` were captured on the same Chrome 155.0.8059.80 target, origin, and 1586×836 viewport after implementation. `compare_web_screenshots` reports different images, with 1,276 of 1,325,896 pixels changed (0.096%; mean absolute channel delta 0.030). The default performance view visibly adds the selected pad EDIT badge. The comparator is a pixel diff; it does not perform OCR or semantic layout analysis. Captures are browser viewport evidence only and do not claim installed-PWA, physical-touch, hosted, or deployment behavior.

## Independent browser checks

- On isolated localhost origin `http://127.0.0.1:4183/`, keyboard shortcuts W and 3 changed selection to Pads 02 and 15; Pad 02 exposed PLAY and “playing” while auditioning. The editor and assignment target followed Pad 15, then `Pad 15 · Probe Pad` after a temporary custom-name save. Returning to LIVE preserved Pad 15.
- A preview-tone change showed “Sample removal staged for Pad 15. Save pad to apply.” Saving returned the target to Pad 15’s ready state. Loop on/off was toggled and restored to one-shot.
- The viewport API returned 400×1000 when asked for 320×800. At 400px, document scroll width was 381px with no horizontal overflow; the viewport was reset afterward. The normal browser viewport was 1600×900 with no overflow.
- On the isolated test origin, the browser file chooser loaded a generated 8.9 KB WAV. The app reported `Staged replacement: launchpad-rea-test.wav → Pad 15. Save pad to apply.`, then `#15 updated and saved.`; the library showed one file and current sound `launchpad-rea-test.wav`. Selecting it for batch assignment previewed `1 selected · will assign to Pad 15.` and completed with `1 sample assigned to Pad 15.`; the sample row reported `1 pad`. No original-origin browser data was used.