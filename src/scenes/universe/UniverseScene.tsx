import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SkyLoader } from "../../components/SkyLoader";
import { fetchLetters } from "../../features/heart/heartLetters";
import { getStoredIdentity } from "../../features/gate/VisitorIdentity";
import { useExperienceStore } from "../../store/experienceStore";
import { UniverseWorld, type UniverseWorldHandle } from "./world/UniverseWorld";

// Each planet panel is its own chunk, so the first paint of the universe
// doesn't download the music player, puzzles, 3D star map and so on.
const loadBlooming = () => import("../../features/blooming/BloomingPlanet");
const loadEcho = () => import("../../features/echo/EchoMoon");
const loadHeart = () => import("../../features/heart/HeartChamber");
const loadTimeline = () => import("../../features/memories/MemoryTimeline");
const BloomingPlanet = lazy(() => loadBlooming().then((m) => ({ default: m.BloomingPlanet })));
const EchoMoon = lazy(() => loadEcho().then((m) => ({ default: m.EchoMoon })));
const HeartChamber = lazy(() => loadHeart().then((m) => ({ default: m.HeartChamber })));
const MemoryTimeline = lazy(() => loadTimeline().then((m) => ({ default: m.MemoryTimeline })));

type CelestialObject = {
  id: "memory-constellation" | "garden-planet" | "echo-moon" | "heart-chamber" | "future-stars";
  name: string;
  whisper: string;
  detail: string;
};

const celestialObjects: CelestialObject[] = [
  {
    id: "memory-constellation",
    name: "The Remembering Stars",
    whisper: "A constellation of firsts, laughter, and little forever moments.",
    detail: "A timeline of firsts, laughter, little forever things, and favorite pictures that drift back into view.",
  },
  {
    id: "garden-planet",
    name: "The Blooming Planet",
    whisper: "A garden where every flower knows something beautiful about her.",
    detail:
      "This becomes the compliments and affirmations space, with glowing flowers that open into gentle words and falling petals.",
  },
  {
    id: "echo-moon",
    name: "Echo Moon",
    whisper: "Songs orbit here, each one tied to a memory.",
    detail:
      "This will hold the shared soundtrack: a spinning record, soft glow pulses, and memories attached to every song.",
  },
  {
    id: "heart-chamber",
    name: "The Heart Chamber",
    whisper: "Only the Queen may enter.",
    detail:
      "The sacred core: letters from Sir Henry, typed slowly, with future messages that unlock when their moment arrives.",
  },
  {
    id: "future-stars",
    name: "Tomorrow's Stars",
    whisper: "Some memories are still on their way.",
    detail:
      "These dim stars will unlock on future dates, turning anticipation into part of the universe itself.",
  },
];

export function UniverseScene() {
  const activeObjectId = useExperienceStore((state) => state.activeObjectId);
  const focusObject = useExperienceStore((state) => state.focusObject);
  const clearFocus = useExperienceStore((state) => state.clearFocus);
  const activeObject = celestialObjects.find((object) => object.id === activeObjectId);
  const [heartChamberHasUnread, setHeartChamberHasUnread] = useState(false);

  useEffect(() => {
    if (activeObjectId !== null) {
      // Only worth checking when we're actually looking at the hub -
      // this also means the badge refreshes the moment you back out of
      // the chamber, since that transition sets activeObjectId to null.
      return;
    }

    const identity = getStoredIdentity();
    if (!identity) {
      return;
    }

    let isMounted = true;
    fetchLetters(identity)
      .then((loaded) => {
        if (isMounted) {
          setHeartChamberHasUnread(loaded.some((letter) => letter.isUnread));
        }
      })
      .catch(() => {
        // Leave the badge as-is if this fails - not worth surfacing an error for.
      });

    return () => {
      isMounted = false;
    };
  }, [activeObjectId]);
  // Warm the panel chunks once the sky has settled, so tapping a planet
  // opens instantly. Skipped on data-saver connections.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) {
      return;
    }

    const warm = () => void Promise.all([loadBlooming(), loadEcho(), loadHeart(), loadTimeline()]);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 6000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(warm, 3000);
    return () => window.clearTimeout(id);
  }, []);

  const worldRef = useRef<UniverseWorldHandle | null>(null);
  const [transitioningObjectId, setTransitioningObjectId] = useState<CelestialObject["id"] | null>(null);
  const previousActiveRef = useRef(activeObjectId);

  // Escape closes whichever planet panel is open (keyboard / tablet keyboards).
  useEffect(() => {
    if (!activeObjectId) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearFocus();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeObjectId, clearFocus]);

  // Backing out of a planet: the camera glides home through the universe.
  useEffect(() => {
    if (previousActiveRef.current !== null && activeObjectId === null) {
      void worldRef.current?.flyHome();
    }
    previousActiveRef.current = activeObjectId;
  }, [activeObjectId]);

  const enterObject = async (id: CelestialObject["id"]) => {
    if (transitioningObjectId || activeObjectId) {
      return;
    }

    setTransitioningObjectId(id);
    await worldRef.current?.flyTo(id);
    focusObject(id);
    setTransitioningObjectId(null);
  };

  return (
    <motion.section
      className={transitioningObjectId ? "universe scene is-travelling" : "universe scene"}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <UniverseWorld
        ref={worldRef}
        labels={celestialObjects.map(({ id, name, whisper }) => ({ id, name, whisper }))}
        paused={activeObjectId !== null && transitioningObjectId === null}
        travelling={transitioningObjectId !== null}
        heartHasUnread={heartChamberHasUnread}
        onEnter={(id) => void enterObject(id)}
      />
      <motion.div
        className="universe__arrival-bloom"
        initial={{ opacity: 0.9, scale: 0.16 }}
        animate={{ opacity: 0, scale: 3.2 }}
        transition={{ duration: 1.8, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        className="universe__arrival-dust"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 0.72, 0], scale: [0.8, 1.2, 1.55] }}
        transition={{ duration: 3.2, ease: "easeOut" }}
      />

      <motion.div
        className="universe__invitation"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 1.1 }}
      >
        <p>The universe is awake now.</p>
        <span>Look around. Drift closer. Let the glowing places answer.</span>
      </motion.div>

      <div className="universe-controls" aria-label="Universe view controls">
        <button type="button" onClick={() => worldRef.current?.dolly(10)} aria-label="Move closer">
          +
        </button>
        <button type="button" onClick={() => worldRef.current?.dolly(-10)} aria-label="Move farther">
          -
        </button>
        <button type="button" onClick={() => worldRef.current?.resetView()} aria-label="Reset universe view">
          reset
        </button>
      </div>

      <AnimatePresence>
        {activeObject?.id === "memory-constellation" && (
          <Suspense key="memory-constellation" fallback={<SkyLoader inline />}>
            <MemoryTimeline onClose={clearFocus} />
          </Suspense>
        )}
        {activeObject?.id === "garden-planet" && (
          <Suspense key="garden-planet" fallback={<SkyLoader inline />}>
            <BloomingPlanet onClose={clearFocus} />
          </Suspense>
        )}
        {activeObject?.id === "echo-moon" && (
          <Suspense key="echo-moon" fallback={<SkyLoader inline />}>
            <EchoMoon onClose={clearFocus} />
          </Suspense>
        )}
        {activeObject?.id === "heart-chamber" && (
          <Suspense key="heart-chamber" fallback={<SkyLoader inline />}>
            <HeartChamber onClose={clearFocus} />
          </Suspense>
        )}

        {activeObject &&
          activeObject.id !== "memory-constellation" &&
          activeObject.id !== "garden-planet" &&
          activeObject.id !== "echo-moon" &&
          activeObject.id !== "heart-chamber" && (
          <motion.aside
            className="revelation"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.99 }}
            transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
          >
            <button className="revelation__close" type="button" onClick={clearFocus} aria-label="Return to universe">
              Return
            </button>
            <p className="revelation__eyebrow">A place has opened</p>
            <h2>{activeObject.name}</h2>
            <p>{activeObject.detail}</p>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.section>
  );
}