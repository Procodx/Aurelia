import { type CSSProperties, type PointerEvent, type WheelEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import gsap from "gsap";
import { playPlanetEnter } from "../../animations/planetEnter";
import { ThreeStarfield } from "../../components/ThreeStarfield";
import { BloomingPlanet } from "../../features/blooming/BloomingPlanet";
import { EchoMoon } from "../../features/echo/EchoMoon";
import { HeartChamber } from "../../features/heart/HeartChamber";
import { MemoryConstellation } from "../../features/memories/MemoryConstellation";
import { MemoryTimeline } from "../../features/memories/MemoryTimeline";
import { useExperienceStore } from "../../store/experienceStore";

type CelestialObject = {
  id: "memory-constellation" | "garden-planet" | "echo-moon" | "heart-chamber" | "future-stars";
  name: string;
  whisper: string;
  detail: string;
  className: string;
  delay: number;
  drift: number;
  orbitX: number;
  orbitY: number;
  orbitDuration: number;
  orbitStart: number;
  bodyScale: number;
};

const celestialObjects: CelestialObject[] = [
  {
    id: "memory-constellation",
    name: "The Remembering Stars",
    whisper: "A constellation of firsts, laughter, and little forever moments.",
      detail:
      "A timeline of firsts, laughter, little forever things, and favorite pictures that drift back into view.",
    className: "celestial celestial--constellation",
    delay: 0.4,
    drift: 0.2,
    orbitX: 465,
    orbitY: 205,
    orbitDuration: 80,
    orbitStart: 50,
    bodyScale: 0.9,
  },
  {
    id: "garden-planet",
    name: "The Blooming Planet",
    whisper: "A garden where every flower knows something beautiful about her.",
    detail:
      "This becomes the compliments and affirmations space, with glowing flowers that open into gentle words and falling petals.",
    className: "celestial celestial--garden",
    delay: 0.72,
    drift: 1.4,
    orbitX: 530,
    orbitY: 240,
    orbitDuration: 88,
    orbitStart: 160,
    bodyScale: 0.92,
  },
  {
    id: "echo-moon",
    name: "Echo Moon",
    whisper: "Songs orbit here, each one tied to a memory.",
    detail:
      "This will hold the shared soundtrack: a spinning record, soft glow pulses, and memories attached to every song.",
    className: "celestial celestial--moon",
    delay: 1.04,
    drift: 2.2,
    orbitX: 590,
    orbitY: 270,
    orbitDuration: 104,
    orbitStart: 258,
    bodyScale: 0.88,
  },
  {
    id: "heart-chamber",
    name: "The Heart Chamber",
    whisper: "Only the Queen may enter.",
    detail:
      "The sacred core: letters from Sir Henry, typed slowly, with future messages that unlock when their moment arrives.",
    className: "celestial celestial--heart",
    delay: 1.36,
    drift: 0.85,
    orbitX: 390,
    orbitY: 170,
    orbitDuration: 72,
    orbitStart: 300,
    bodyScale: 0.98,
  },
  {
    id: "future-stars",
    name: "Tomorrow's Stars",
    whisper: "Some memories are still on their way.",
    detail:
      "These dim stars will unlock on future dates, turning anticipation into part of the universe itself.",
    className: "celestial celestial--future",
    delay: 1.68,
    drift: 2.9,
    orbitX: 620,
    orbitY: 300,
    orbitDuration: 120,
    orbitStart: 128,
    bodyScale: 0.84,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const mapSize = { width: 1280, height: 760 };
const orbitCenter = { x: 640, y: 390 };
const desktopView = { defaultZoom: 1, minZoom: 0.72, maxZoom: 1.58 };
const mobileView = { defaultZoom: 0.54, minZoom: 0.44, maxZoom: 1.24 };

function getViewSettings() {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) {
    return mobileView;
  }

  return desktopView;
}

function getOrbitPosition(object: CelestialObject, elapsedSeconds: number) {
  const angle = ((object.orbitStart + (elapsedSeconds / object.orbitDuration) * 360) * Math.PI) / 180;
  const x = Math.cos(angle) * object.orbitX;
  const y = Math.sin(angle) * object.orbitY;
  const depth = (Math.sin(angle) + 1) / 2;

  return {
    x: orbitCenter.x + x,
    y: orbitCenter.y + y,
    scale: object.bodyScale * (0.86 + depth * 0.22),
    zIndex: Math.round(20 + depth * 20),
  };
}

function getOrbitTransform(object: CelestialObject, elapsedSeconds: number) {
  const position = getOrbitPosition(object, elapsedSeconds);
  return {
    transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${position.scale})`,
    zIndex: position.zIndex,
  };
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export function UniverseScene() {
  const activeObjectId = useExperienceStore((state) => state.activeObjectId);
  const focusObject = useExperienceStore((state) => state.focusObject);
  const clearFocus = useExperienceStore((state) => state.clearFocus);
  const activeObject = celestialObjects.find((object) => object.id === activeObjectId);
  const genericObjects = celestialObjects.filter((object) => object.id !== "memory-constellation");
  const memoryObject = celestialObjects.find((object) => object.id === "memory-constellation")!;
  // Motion values instead of useState: dragging/zooming calls .set() directly,
  // which pushes straight to the DOM transform without a React re-render.
  // Previously these were useState, so every pointermove while dragging
  // re-rendered the whole scene (all 5 planets, the SVG orbit rings, etc.) —
  // that was the main source of the lag while panning the sky.
  const zoomMV = useMotionValue(getViewSettings().defaultZoom);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const [transitioningObjectId, setTransitioningObjectId] = useState<CelestialObject["id"] | null>(null);
  const [visitedObjectIds, setVisitedObjectIds] = useState<Set<CelestialObject["id"]>>(() => new Set());
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const universeRef = useRef<HTMLElement | null>(null);
  const celestialLayerRef = useRef<HTMLDivElement | null>(null);
  const warpRef = useRef<HTMLDivElement | null>(null);
  const planetRefs = useRef(new Map<CelestialObject["id"], HTMLDivElement>());
  const orbitTimeRef = useRef(0);
  const overlayOpenRef = useRef(activeObjectId !== null);

  useEffect(() => {
    // transitioningObjectId covers the ~1s GSAP warp animation that plays
    // while a world is opening. Without it here, the orbit tick below kept
    // writing planetElement.style.transform every frame while GSAP's
    // playPlanetEnter timeline was independently tweening transform on that
    // exact same element — two animation systems fighting over one CSS
    // property on the same node, which is what caused the stutter on entry.
    overlayOpenRef.current = activeObjectId !== null || transitioningObjectId !== null;
  }, [activeObjectId, transitioningObjectId]);

  useEffect(() => {
    // Driven by GSAP's shared ticker rather than a second, independent
    // requestAnimationFrame loop. Every warp/entry animation in this app
    // already runs on GSAP's ticker, which internally uses a single rAF
    // registration no matter how many listeners are attached to it — so
    // adding this tick here doesn't cost the browser an extra callback
    // per frame the way a standalone rAF loop would, it just runs inside
    // the one that's already ticking.
    const startedAt = gsap.ticker.time;

    const tick = () => {
      // The planets are fully hidden behind the revelation/overlay panel
      // once one is open, so skip the transform math and let the CPU idle.
      if (overlayOpenRef.current) {
        return;
      }

      const elapsedSeconds = gsap.ticker.time - startedAt;
      orbitTimeRef.current = elapsedSeconds;

      for (const object of celestialObjects) {
        const planetElement = planetRefs.current.get(object.id);
        if (!planetElement) {
          continue;
        }

        const position = getOrbitTransform(object, elapsedSeconds);
        planetElement.style.transform = position.transform;
        planetElement.style.zIndex = `${position.zIndex}`;
      }
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (transitioningObjectId || (event.target as HTMLElement).closest("button, aside, .universe-controls")) {
      return;
    }

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: panX.get(),
      panY: panY.get(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragRef.current) {
      return;
    }

    panX.set(dragRef.current.panX + event.clientX - dragRef.current.x);
    panY.set(dragRef.current.panY + event.clientY - dragRef.current.y);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    if (activeObjectId || transitioningObjectId) {
      return;
    }

    event.preventDefault();
    const viewSettings = getViewSettings();
    zoomMV.set(clamp(zoomMV.get() - event.deltaY * 0.0011, viewSettings.minZoom, viewSettings.maxZoom));
  };

  const resetView = () => {
    const viewSettings = getViewSettings();
    panX.set(0);
    panY.set(0);
    zoomMV.set(viewSettings.defaultZoom);
  };

  const rememberPlanetRef = (id: CelestialObject["id"]) => (node: HTMLDivElement | null) => {
    if (node) {
      planetRefs.current.set(id, node);
      return;
    }

    planetRefs.current.delete(id);
  };

  const enterObject = async (object: CelestialObject) => {
    if (transitioningObjectId || activeObjectId) {
      return;
    }

    const universeElement = universeRef.current;
    const layerElement = celestialLayerRef.current;
    const warpElement = warpRef.current;
    const planetElement = planetRefs.current.get(object.id);
    const objectPosition = getOrbitPosition(object, orbitTimeRef.current);
    const viewSettings = getViewSettings();
    const entryZoom =
      viewSettings === mobileView ? (object.id === "heart-chamber" ? 0.94 : 0.9) : object.id === "heart-chamber" ? 1.32 : 1.24;

    setTransitioningObjectId(object.id);
    setVisitedObjectIds((current) => new Set(current).add(object.id));
    zoomMV.set(entryZoom);
    panX.set(-(objectPosition.x - orbitCenter.x) * entryZoom);
    panY.set(-(objectPosition.y - orbitCenter.y) * entryZoom);

    await waitForNextPaint();

    if (universeElement && layerElement && planetElement && warpElement) {
      await playPlanetEnter({
        universe: universeElement,
        layer: layerElement,
        planet: planetElement,
        warp: warpElement,
      });
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }

    focusObject(object.id);
    setTransitioningObjectId(null);
  };

  return (
    <motion.section
      ref={universeRef}
      className={transitioningObjectId ? "universe scene is-travelling" : "universe scene"}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <ThreeStarfield
        className="three-starfield universe__starfield"
        intensity="awake"
        density={1200}
        depth={980}
        paused={activeObjectId !== null || transitioningObjectId !== null}
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
      <div className="cosmic-haze cosmic-haze--blue" />
      <div className="cosmic-haze cosmic-haze--rose" />
      <div
        ref={warpRef}
        className={transitioningObjectId ? `planet-warp planet-warp--${transitioningObjectId}` : "planet-warp"}
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </div>

      <motion.div
        className="universe__invitation"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 1.1 }}
      >
        <p>The universe is awake now.</p>
        <span>Drag the sky. Move closer. Let the glowing places answer.</span>
      </motion.div>

      <div className="universe-controls" aria-label="Universe view controls">
        <button
          type="button"
          onClick={() => {
            const viewSettings = getViewSettings();
            zoomMV.set(clamp(zoomMV.get() + 0.12, viewSettings.minZoom, viewSettings.maxZoom));
          }}
          aria-label="Move closer"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            const viewSettings = getViewSettings();
            zoomMV.set(clamp(zoomMV.get() - 0.12, viewSettings.minZoom, viewSettings.maxZoom));
          }}
          aria-label="Move farther"
        >
          -
        </button>
        <button type="button" onClick={resetView} aria-label="Reset universe view">
          reset
        </button>
      </div>

      <motion.div
        className="universe__camera"
        aria-label="Explorable celestial memories"
        style={{ x: panX, y: panY, scale: zoomMV }}
        transition={{ type: "spring", stiffness: 90, damping: 24 }}
      >
        <div ref={celestialLayerRef} className="celestial-layer">
          <svg className="orbit-rings" viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} aria-hidden="true">
          <defs>
            <linearGradient id="orbitGlow" x1="0" x2="1" y1="0" y2="0">
              <stop stopColor="rgba(255, 215, 132, 0)" offset="0" />
              <stop stopColor="rgba(255, 215, 132, 0.34)" offset="0.45" />
              <stop stopColor="rgba(143, 214, 255, 0.32)" offset="0.72" />
              <stop stopColor="rgba(255, 215, 132, 0)" offset="1" />
            </linearGradient>
          </defs>
          {celestialObjects.map((object) => (
            <ellipse
              className="orbit-ring"
              key={object.id}
              cx={orbitCenter.x}
              cy={orbitCenter.y}
              rx={object.orbitX}
              ry={object.orbitY}
              style={{ "--ring-index": `${celestialObjects.indexOf(object) + 1}` } as CSSProperties}
            />
          ))}
          <ellipse className="orbit-ring orbit-ring--wide" cx={orbitCenter.x} cy={orbitCenter.y} rx="690" ry="330" />
          </svg>

          <div className="heart-sun" style={{ left: orbitCenter.x, top: orbitCenter.y }} aria-hidden="true">
            <span />
            <strong>Love</strong>
          </div>

          <motion.div
            ref={rememberPlanetRef(memoryObject.id)}
            className={`orbiting-object orbiting-object--memory ${
              visitedObjectIds.has(memoryObject.id) ? "has-been-visited" : ""
            } ${transitioningObjectId === memoryObject.id ? "is-selected-for-entry" : ""}`}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
            }}
            transition={{ duration: 1.7, delay: memoryObject.delay, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transform: getOrbitTransform(memoryObject, 0).transform,
              zIndex: getOrbitTransform(memoryObject, 0).zIndex,
            }}
          >
            <MemoryConstellation
              name={memoryObject.name}
              whisper={memoryObject.whisper}
              delay={memoryObject.delay}
              drift={memoryObject.drift}
              onOpen={() => void enterObject(memoryObject)}
            />
          </motion.div>

          {genericObjects.map((object) => (
            <motion.div
              ref={rememberPlanetRef(object.id)}
              className={`orbiting-object ${visitedObjectIds.has(object.id) ? "has-been-visited" : ""} ${
                transitioningObjectId === object.id ? "is-selected-for-entry" : ""
              }`}
              key={object.id}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
              }}
              transition={{ duration: 1.7, delay: object.delay, ease: [0.16, 1, 0.3, 1] }}
              style={{
                transform: getOrbitTransform(object, 0).transform,
                zIndex: getOrbitTransform(object, 0).zIndex,
              }}
            >
              <motion.button
                className={object.className}
                type="button"
                onClick={() => void enterObject(object)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.span
                  className="celestial__body"
                  animate={{
                    y: [0, -16, 0, 10, 0],
                    rotate: [0, 1.4, 0, -1.2, 0],
                    scale: [1, 1.035, 1, 0.99, 1],
                  }}
                  transition={{
                    duration: 8.5,
                    repeat: Infinity,
                    delay: object.drift,
                    ease: [0.42, 0, 0.58, 1],
                  }}
                />
                <span className="celestial__aura" />
                <span className="celestial__name">{object.name}</span>
                <span className="celestial__whisper">{object.whisper}</span>
              </motion.button>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {activeObject?.id === "memory-constellation" && <MemoryTimeline onClose={clearFocus} />}
        {activeObject?.id === "garden-planet" && <BloomingPlanet onClose={clearFocus} />}
        {activeObject?.id === "echo-moon" && <EchoMoon onClose={clearFocus} />}
        {activeObject?.id === "heart-chamber" && <HeartChamber onClose={clearFocus} />}

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