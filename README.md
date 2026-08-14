# Touchscreen Launchpad

A browser-based launchpad for triggering samples and loops from a touchscreen laptop.

This repository starts with a dependency-free prototype scaffold. The current pad grid uses Web Audio synthesis so it can be tested before sample assets are added.

## Current scaffold

- Responsive 4x4 touch-friendly pad grid
- Keyboard-accessible pads
- Web Audio startup and stop-all control
- Tempo control placeholder for future beat synchronization
- Empty `samples/` directory ready for local WAV or MP3 assets

## Run it

Clone the repository and open `index.html` in a modern browser such as Edge or Chrome:

```bash
git clone https://github.com/icecold009/touchscreen-launchpad.git
cd touchscreen-launchpad
```

Then open `index.html`. Tap a pad once to unlock audio and trigger its prototype tone.

## Project structure

```text
.
├── app.js
├── index.html
├── style.css
└── samples/
    ├── README.md
    └── .gitkeep
```

## Next steps

1. Replace the prototype tones with decoded audio samples.
2. Add one-shot and looping modes.
3. Add BPM quantization and beat synchronization.
4. Add sample upload and saved pad layouts.
5. Package the app as an installable offline PWA.

## License

No license has been selected yet.
