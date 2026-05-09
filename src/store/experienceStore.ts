import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

type Scene = "landing" | "universe";

type CelestialObjectId =
  | "memory-constellation"
  | "garden-planet"
  | "echo-moon"
  | "heart-chamber"
  | "future-stars";

type ExperienceState = {
  scene: Scene;
  activeObjectId: CelestialObjectId | null;
  discoveredObjectIds: CelestialObjectId[];
  enterUniverse: () => void;
  focusObject: (id: CelestialObjectId) => void;
  clearFocus: () => void;
};

const persistenceKey = "aurelia.experience-state";
const persistenceTtlMs = 1000 * 60 * 60 * 24 * 2;

type ExpiringStorageValue = {
  value: string;
  expiresAt: number;
};

const expiringLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(name);
    if (!raw) {
      return null;
    }

    try {
      const stored = JSON.parse(raw) as ExpiringStorageValue;
      if (typeof stored.expiresAt !== "number" || stored.expiresAt < Date.now()) {
        window.localStorage.removeItem(name);
        return null;
      }

      return stored.value;
    } catch {
      window.localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      name,
      JSON.stringify({
        value,
        expiresAt: Date.now() + persistenceTtlMs,
      } satisfies ExpiringStorageValue),
    );
  },
  removeItem: (name) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(name);
  },
};

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set) => ({
      scene: "landing",
      activeObjectId: null,
      discoveredObjectIds: [],
      enterUniverse: () => set({ scene: "universe", activeObjectId: null }),
      focusObject: (id) =>
        set((state) => ({
          activeObjectId: id,
          discoveredObjectIds: state.discoveredObjectIds.includes(id)
            ? state.discoveredObjectIds
            : [...state.discoveredObjectIds, id],
        })),
      clearFocus: () => set({ activeObjectId: null }),
    }),
    {
      name: persistenceKey,
      storage: createJSONStorage(() => expiringLocalStorage),
      partialize: (state) => ({
        scene: state.scene,
        activeObjectId: state.activeObjectId,
        discoveredObjectIds: state.discoveredObjectIds,
      }),
    },
  ),
);
