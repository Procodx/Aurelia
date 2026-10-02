import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SkyLoader } from "../../components/SkyLoader";
import { fetchLetters, heartLettersFallback, markLetterRead } from "../../features/heart/heartLetters";
import { getStoredIdentity } from "../../features/gate/VisitorIdentity";
import { useExperienceStore } from "../../store/experienceStore";
import { requestTiltPermission } from "../../utils/deviceTilt";
import { createUnlockedAudio } from "./world/vrAudio";
import { UniverseWorld, type UniverseWorldHandle } from "./world/UniverseWorld";
import type { VRPlace } from "./world/vrPlace";

// Each planet panel is its own chunk, so the first paint of the universe
// doesn't download the music player, puzzles, 3D star map and so on.
const loadBlooming = () => import("../../features/blooming/BloomingPlanet");
const loadEcho = () => import("../../features/echo/EchoMoon");
const loadHeart = () => import("../../features/heart/HeartChamber");
const loadTimeline = () => import("../../features/memories/MemoryTimeline");
const loadStars = () => import("../../features/stars/TomorrowsStars");
const BloomingPlanet = lazy(() => loadBlooming().then((m) => ({ default: m.BloomingPlanet })));
const EchoMoon = lazy(() => loadEcho().then((m) => ({ default: m.EchoMoon })));
const HeartChamber = lazy(() => loadHeart().then((m) => ({ default: m.HeartChamber })));
const TomorrowsStars = lazy(() => loadStars().then((m) => ({ default: m.TomorrowsStars })));
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

    const warm = () => void Promise.all([loadBlooming(), loadEcho(), loadHeart(), loadTimeline(), loadStars()]);
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

  // Google Cardboard mode.
  const [vr, setVr] = useState(false);
  const [vrVisiting, setVrVisiting] = useState<CelestialObject["id"] | null>(null);
  const vrFullscreenRef = useRef(false);
  const vrVisitingRef = useRef<CelestialObject["id"] | null>(null);
  const vrAudioRef = useRef<HTMLAudioElement | null>(null);
  const vrNoteRef = useRef(false);
  const [starNote, setStarNote] = useState<string | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    document.body.classList.toggle("vr-active", vr);
    return () => document.body.classList.remove("vr-active");
  }, [vr]);

  // While a panel is open she is standing inside that world; the panel turns
  // to glass so the world shows through.
  useEffect(() => {
    document.body.classList.toggle("has-interior", activeObjectId !== null);
    return () => document.body.classList.remove("has-interior");
  }, [activeObjectId]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __world?: UniverseWorldHandle | null }).__world = worldRef.current;
    }
  });

  const startVR = async () => {
    if (vr) {
      return;
    }

    // All of these need to happen inside the tap that started VR. The audio
    // element has to be unlocked first, while the tap is still "fresh".
    vrAudioRef.current = createUnlockedAudio();
    await requestTiltPermission();
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
      vrFullscreenRef.current = Boolean(document.fullscreenElement);
    } catch {
      vrFullscreenRef.current = false;
    }
    try {
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch {
      // Not supported everywhere (iPhone) - the viewer is held sideways anyway.
    }
    try {
      wakeLockRef.current = (await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLockRef.current = null;
    }

    worldRef.current?.setDockMode("exit");
    worldRef.current?.enterVR();
    setVrVisiting(null);
    setVr(true);
  };

  const stopVR = () => {
    worldRef.current?.exitVR();
    vrNoteRef.current = false;
    setVr(false);
    vrVisitingRef.current = null;
    setVrVisiting(null);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    vrFullscreenRef.current = false;
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
    } catch {
      // ignore
    }
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  };

  // Leaving fullscreen (system back gesture, Escape) also leaves VR.
  useEffect(() => {
    if (!vr) {
      return;
    }

    const handleFullscreen = () => {
      if (vrFullscreenRef.current && !document.fullscreenElement) {
        stopVR();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopVR();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreen);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreen);
      window.removeEventListener("keydown", handleKey);
    };
    // stopVR only touches refs and setters, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vr]);

  // Each world has its own way of being experienced in VR.
  const openPlaceInVR = async (id: CelestialObject["id"]) => {
    if (id === "heart-chamber") {
      await openHeartChamberInVR();
      return;
    }

    const world = worldRef.current;
    const viewpoint = world?.getViewpoint();
    if (!world || !viewpoint) {
      return;
    }

    let place: VRPlace | null = null;
    if (id === "memory-constellation") {
      const [{ createMemoriesPlace }, { memoryMoments }] = await Promise.all([
        import("./world/places/memoriesPlace"),
        import("../../features/memories/memoryData"),
      ]);
      place = createMemoriesPlace(memoryMoments, viewpoint);
    } else if (id === "future-stars") {
      const [{ createStarsPlace }, { fetchStars }] = await Promise.all([
        import("./world/places/starsPlace"),
        import("../../features/stars/starsApi"),
      ]);
      place = createStarsPlace((await fetchStars()).stars, viewpoint);
    } else if (id === "garden-planet") {
      const { createGardenPlace } = await import("./world/places/gardenPlace");
      place = await createGardenPlace(viewpoint);
    } else if (id === "echo-moon" && vrAudioRef.current) {
      const { createEchoMoonPlace, loadEchoTracks } = await import("./world/places/echoMoonPlace");
      const tracks = await loadEchoTracks();
      place = tracks.length > 0 ? createEchoMoonPlace({ tracks, viewpoint, audio: vrAudioRef.current }) : null;
    }

    // She may already have pressed Return while this loaded.
    if (place && worldRef.current && vrVisitingRef.current === id) {
      if (import.meta.env.DEV) {
        (window as unknown as { __place?: VRPlace }).__place = place;
      }
      worldRef.current.setPlace(place);
    } else {
      place?.dispose();
    }
  };

  // The Heart Chamber in VR: her letters float around her as glowing pages.
  const openHeartChamberInVR = async () => {
    const identity = getStoredIdentity() ?? "henry";
    const [{ createHeartChamberPlace }, loaded] = await Promise.all([
      import("./world/places/heartChamberPlace"),
      fetchLetters(identity).catch(() => heartLettersFallback),
    ]);
    const viewpoint = worldRef.current?.getViewpoint();
    // She may already have looked away and pressed Return while it loaded.
    if (!viewpoint || !worldRef.current || vrVisitingRef.current !== "heart-chamber") {
      return;
    }

    // Unread letters first, as in the flat chamber.
    const letters = [...(loaded.length > 0 ? loaded : heartLettersFallback)]
      .map((letter) => ({ ...letter }))
      .sort((a, b) => Number(b.isUnread) - Number(a.isUnread));
    worldRef.current.setPlace(
      createHeartChamberPlace({
        letters,
        viewpoint,
        onRead: (letter) => void markLetterRead(identity, letter.id),
      }),
    );
  };

  // A shooting star was caught: its note appears as a card (flat) or floats in front of her (VR).
  const handleMeteor = async () => {
    const { nextShootingStarMessage } = await import("../../features/stars/shootingStarMessages");
    const message = nextShootingStarMessage();
    if (!vr) {
      setStarNote(message);
      return;
    }

    const viewpoint = worldRef.current?.getViewpoint();
    if (!viewpoint) {
      return;
    }
    const { createMessagePlace } = await import("./world/places/messagePlace");
    vrNoteRef.current = true;
    worldRef.current?.setPlace(createMessagePlace(message, viewpoint));
    worldRef.current?.setDockMode("return");
  };

  const handleDock = () => {
    if (vrNoteRef.current) {
      vrNoteRef.current = false;
      worldRef.current?.setPlace(null);
      worldRef.current?.setDockMode("exit");
      return;
    }
    if (vrVisiting) {
      worldRef.current?.setPlace(null);
      vrVisitingRef.current = null;
      setVrVisiting(null);
      worldRef.current?.setDockMode("exit");
      void worldRef.current?.flyHome();
      return;
    }
    stopVR();
  };

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
    if (vr) {
      // In VR a world is visited in place: fly there and hover. The full
      // panels are flat web pages that cannot be shown to two eyes yet.
      if (vrVisiting) {
        return;
      }
      vrVisitingRef.current = id;
      setVrVisiting(id);
      worldRef.current?.setDockMode("return");
      await worldRef.current?.flyTo(id);
      // Dive through the atmosphere and land inside the world, then open its place.
      await worldRef.current?.enterInterior(id);
      await openPlaceInVR(id);
      return;
    }

    if (transitioningObjectId || activeObjectId) {
      return;
    }

    setTransitioningObjectId(id);
    // Fly to the world, dive through its atmosphere and land inside it - the
    // panel then opens over the world she is standing in.
    await worldRef.current?.flyTo(id);
    await worldRef.current?.enterInterior(id);
    focusObject(id);
    setTransitioningObjectId(null);
  };

  return (
    <motion.section
      className={[
        "universe scene",
        transitioningObjectId ? "is-travelling" : "",
        transitioningObjectId || activeObjectId ? "is-inside" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <UniverseWorld
        ref={worldRef}
        labels={celestialObjects.map(({ id, name, whisper }) => ({ id, name, whisper }))}
        paused={false}
        travelling={transitioningObjectId !== null || activeObjectId !== null}
        heartHasUnread={heartChamberHasUnread}
        vr={vr}
        onEnter={(id) => void enterObject(id)}
        onDock={handleDock}
        onMeteor={() => void handleMeteor()}
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
        <span>You float at its heart. Turn around: the worlds circle you. Let the glowing places answer.</span>
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
        <button
          type="button"
          className="universe-controls__vr"
          onClick={() => void startVR()}
          aria-label="Enter Google Cardboard VR mode"
          title="Cardboard VR"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5C3 7.7 3.7 7 4.5 7h15c.8 0 1.5.7 1.5 1.5v6c0 .8-.7 1.5-1.5 1.5h-4.2c-.5 0-1-.3-1.3-.7l-.6-1c-.3-.5-.9-.8-1.4-.8s-1.1.3-1.4.8l-.6 1c-.3.4-.8.7-1.3.7H4.5C3.7 16 3 15.3 3 14.5v-6Z" />
            <circle cx="8" cy="11.5" r="1.4" />
            <circle cx="16" cy="11.5" r="1.4" />
          </svg>
          <span>VR</span>
        </button>
      </div>

      <AnimatePresence>
        {starNote && !vr && (
          <motion.aside
            key="star-note"
            className="star-note"
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p>A shooting star left this for you</p>
            <blockquote>{starNote}</blockquote>
            <span>Sir Henry</span>
            <button type="button" onClick={() => setStarNote(null)}>
              Keep it close
            </button>
          </motion.aside>
        )}
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

        {activeObject?.id === "future-stars" && (
          <Suspense key="future-stars" fallback={<SkyLoader inline />}>
            <TomorrowsStars onClose={clearFocus} />
          </Suspense>
        )}

        {activeObject &&
          activeObject.id !== "memory-constellation" &&
          activeObject.id !== "future-stars" &&
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