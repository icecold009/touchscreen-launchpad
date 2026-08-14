const padGrid = document.querySelector("#pad-grid");
const statusMessage = document.querySelector("#status");
const stopAllButton = document.querySelector("#stop-all");

const padColors = [
  "#e45756", "#e76f51", "#f4a261", "#e9c46a",
  "#2a9d8f", "#36b37e", "#4cc9a5", "#52b788",
  "#277da1", "#3a86ff", "#4361ee", "#4d5bd5",
  "#8338ec", "#9b5de5", "#c77dff", "#bc6ff1",
];

const keyboardKeys = ["Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V", "1", "2", "3", "4"];
const activeSources = new Set();
let audioContext;

const pads = Array.from({ length: 16 }, (_, index) => ({
  index,
  label: `Pad ${String(index + 1).padStart(2, "0")}`,
  key: keyboardKeys[index],
  frequency: 180 * Math.pow(2, (index % 8) / 8),
}));

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playPad(pad, element) {
  const context = getAudioContext();
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(pad.frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.32, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.45);
  activeSources.add(oscillator);

  element.classList.add("is-playing");
  statusMessage.textContent = `${pad.label} triggered at ${pad.frequency.toFixed(0)} Hz.`;

  oscillator.addEventListener("ended", () => {
    activeSources.delete(oscillator);
    element.classList.remove("is-playing");
  }, { once: true });
}

function stopAll() {
  for (const source of activeSources) {
    source.stop();
  }

  activeSources.clear();
  document.querySelectorAll(".pad").forEach((pad) => pad.classList.remove("is-playing"));
  statusMessage.textContent = "All pads stopped.";
}

function renderPads() {
  for (const pad of pads) {
    const button = document.createElement("button");
    button.className = "pad";
    button.type = "button";
    button.style.background = padColors[pad.index];
    button.setAttribute("aria-label", `${pad.label}, keyboard shortcut ${pad.key}`);
    button.innerHTML = `
      <span class="pad-label">${pad.label}</span>
      <span class="pad-key">${pad.key}</span>
    `;

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      playPad(pad, button);
    });

    padGrid.appendChild(button);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  const padIndex = keyboardKeys.indexOf(event.key.toUpperCase());
  if (padIndex === -1) return;

  const button = padGrid.children[padIndex];
  if (button) playPad(pads[padIndex], button);
});

stopAllButton.addEventListener("click", stopAll);
renderPads();
