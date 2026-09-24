export const LOCAL_SETTINGS_KEYS = Object.freeze({
  layout: "touchscreen-launchpad.layout.v1",
  currentKit: "touchscreen-launchpad.current-kit.v1",
  kitMirror: "touchscreen-launchpad.kits-mirror.v1",
});

export function createLocalSettings({ storage, keys = LOCAL_SETTINGS_KEYS } = {}) {
  function getStorage() {
    return typeof storage === "function" ? storage() : storage;
  }

  return Object.freeze({
    readLayout() {
      const serialized = getStorage().getItem(keys.layout);
      return serialized ? JSON.parse(serialized) : undefined;
    },
    writeLayout(layout) {
      getStorage().setItem(keys.layout, JSON.stringify(layout));
    },
    readCurrentKitId() {
      return getStorage().getItem(keys.currentKit);
    },
    writeCurrentKitId(kitId) {
      getStorage().setItem(keys.currentKit, kitId);
    },
    readKitMirror() {
      try {
        const serialized = getStorage().getItem(keys.kitMirror);
        const parsed = serialized ? JSON.parse(serialized) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    writeKitMirror(records) {
      getStorage().setItem(keys.kitMirror, JSON.stringify(records));
    },
    removeKitMirror() {
      getStorage().removeItem(keys.kitMirror);
    },
  });
}
