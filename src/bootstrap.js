import { initLaunchpad } from "../app.js?version=21";

function reportBootstrapFailure(error, documentRef = document, consoleRef = console) {
  const statusMessage = documentRef.querySelector("#status");
  if (statusMessage) {
    statusMessage.textContent = "Launchpad could not start. Reload this page to try again.";
    statusMessage.dataset.type = "error";
  }
  consoleRef.error("Launchpad failed to start.", error);
}

export async function bootstrapLaunchpad({
  initialize = initLaunchpad,
  documentRef = document,
  consoleRef = console,
} = {}) {
  try {
    await initialize();
  } catch (error) {
    reportBootstrapFailure(error, documentRef, consoleRef);
  }
}

void bootstrapLaunchpad();
