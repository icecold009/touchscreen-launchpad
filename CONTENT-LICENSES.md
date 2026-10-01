# Starter-content licensing manifest

This repository does not redistribute user songs, recordings, or sample packs. The app's starter state uses generated preview tones until a user imports local audio. Stem separation downloads pinned model weights on demand into browser storage; those weights are not included in the repository.

Any future starter kit must add one manifest row before it ships:

| Kit or file | Source / creator | License or clearance | Attribution | Redistribution limit | Verification |
| --- | --- | --- | --- | --- | --- |
| Generated preview tone | Touchscreen Launchpad code | Original generated content | None | Repository use permitted | Contract tests and source review |
| Spleeter 4-stem model weights | Deezer Spleeter weights; ONNX export by Best-Practice from the sherpa-onnx U-Net port | Apache-2.0 model card; model card also records the underlying Spleeter weights as MIT | Deezer, Best-Practice, sherpa-onnx / Xiaomi and Fangjun Kuang | Downloaded from the exact revision `c716977ab2ac15b83411fa7d96f642b82e767a9c`; model weights are not redistributed here | [Pinned model card](https://huggingface.co/Best-Practice/spleeter-4stems-onnx/tree/c716977ab2ac15b83411fa7d96f642b82e767a9c) |
| HT-Demucs 4-stem ONNX weights | Meta/Fair Demucs weights converted to ONNX by StemSplit | MIT per model card | Meta/Fair, StemSplit | Downloaded on demand from revision `d54ed9eb60e258ea82131c6ee14578628816456a`; SHA-256 is checked before use; model weights are not redistributed here | [Pinned model card](https://huggingface.co/StemSplitio/htdemucs-onnx/tree/d54ed9eb60e258ea82131c6ee14578628816456a) |
| ONNX Runtime Web | Microsoft ONNX Runtime project | MIT | Microsoft and ONNX Runtime contributors | Dependency runtime is included under `vendor/ort/`; see upstream package license | [ONNX Runtime Web](https://github.com/microsoft/onnxruntime/tree/main/js/web) |
| fft.js | Ivan Kuckir and contributors | MIT | Ivan Kuckir and contributors | Dependency is bundled into the local worker; see upstream project license | [fft.js](https://github.com/indutny/fft.js) |

Content acceptance rules:

- Use original, public-domain, Creative Commons-compatible, or directly cleared material only.
- Record the exact source URL or clearance reference, creator credit, license, and allowed redistribution scope.
- Do not describe a stylistic inspiration as permission to redistribute an artist's recording or stem.
- Keep user-imported audio local to the browser; it is not part of the repository or hosted deployment.
- The stem worker sends no song audio to the model host; only the public model files are fetched.
- Re-run the content/license audit whenever starter audio, launchpacks, or screenshots change.
