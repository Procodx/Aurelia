import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createWorld, type WorldController } from "./buildWorld";
import { worldObjects, type WorldObjectId } from "./worldConfig";
import type { Viewpoint, VRPlace } from "./vrPlace";

export type WorldLabel = { id: WorldObjectId; name: string; whisper: string };

export type UniverseWorldHandle = {
  flyTo: (id: WorldObjectId) => Promise<void>;
  flyHome: () => Promise<void>;
  dolly: (amount: number) => void;
  resetView: () => void;
  enterVR: () => void;
  exitVR: () => void;
  setDockMode: (mode: "exit" | "return") => void;
  aim: (id: WorldObjectId | "dock") => void;
  setPlace: (place: VRPlace | null) => void;
  getViewpoint: () => Viewpoint | null;
  enterInterior: (id: WorldObjectId) => Promise<void>;
  exitInterior: () => Promise<void>;
};

type UniverseWorldProps = {
  labels: WorldLabel[];
  paused: boolean;
  /** Hide labels while travelling to a planet. */
  travelling: boolean;
  heartHasUnread: boolean;
  /** True while in Google Cardboard mode (hides all DOM chrome). */
  vr: boolean;
  onEnter: (id: WorldObjectId) => void;
  onDock: () => void;
};

export const UniverseWorld = forwardRef<UniverseWorldHandle, UniverseWorldProps>(function UniverseWorld(
  { labels, paused, travelling, heartHasUnread, vr, onEnter, onDock },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<WorldController | null>(null);
  const labelRefs = useRef(new Map<string, HTMLElement>());
  const hoverRef = useRef<WorldObjectId | null>(null);
  const onEnterRef = useRef(onEnter);
  const onDockRef = useRef(onDock);

  useEffect(() => {
    onEnterRef.current = onEnter;
    onDockRef.current = onDock;
  }, [onEnter, onDock]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (id) => controllerRef.current?.flyTo(id) ?? Promise.resolve(),
      flyHome: () => controllerRef.current?.flyHome() ?? Promise.resolve(),
      dolly: (amount) => controllerRef.current?.dolly(amount),
      resetView: () => controllerRef.current?.resetView(),
      enterVR: () => controllerRef.current?.enterVR(),
      exitVR: () => controllerRef.current?.exitVR(),
      setDockMode: (mode) => controllerRef.current?.setDockMode(mode),
      aim: (id) => controllerRef.current?.aim(id),
      setPlace: (place) => controllerRef.current?.setPlace(place),
      getViewpoint: () => controllerRef.current?.getViewpoint() ?? null,
      enterInterior: (id) => controllerRef.current?.enterInterior(id) ?? Promise.resolve(),
      exitInterior: () => controllerRef.current?.exitInterior() ?? Promise.resolve(),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const controller = createWorld({
      canvas,
      objects: worldObjects,
      names: Object.fromEntries(labels.map((label) => [label.id, label.name])) as Record<WorldObjectId, string>,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      lowPower: (navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia("(pointer: coarse)").matches,
      onPick: (id) => onEnterRef.current(id),
      onDock: () => onDockRef.current(),
      onHover: (id) => {
        hoverRef.current = id;
        labelRefs.current.forEach((element, key) => element.classList.toggle("is-hovered", key === id));
      },
      positionLabel: (id, x, y, visible, edge) => {
        const element = labelRefs.current.get(id);
        if (!element) {
          return;
        }
        // Worlds on screen hang their name below them; off-screen ones sit on the
        // screen edge with an arrow pointing the way.
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, ${edge ? "-50%" : "0"})`;
        element.style.visibility = visible ? "visible" : "hidden";
        element.classList.toggle("is-edge", Boolean(edge));
        if (edge) {
          element.style.setProperty("--edge-angle", `${edge.angle}rad`);
          // Keep the arrow just outside the name, whatever its length.
          if (!element.dataset.halfWidth) {
            element.dataset.halfWidth = String(Math.round(element.offsetWidth / 2) + 8);
          }
          element.style.setProperty("--edge-radius", `${element.dataset.halfWidth}px`);
        }
      },
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPaused(paused);
  }, [paused]);

  const setLabelRef = (id: string) => (node: HTMLElement | null) => {
    if (node) {
      labelRefs.current.set(id, node);
    } else {
      labelRefs.current.delete(id);
    }
  };

  return (
    <div
      className={["universe-world", travelling || paused ? "is-travelling" : "", vr ? "is-vr" : ""].filter(Boolean).join(" ")}
    >
      <canvas ref={canvasRef} className="universe-world__canvas" aria-label="A three-dimensional universe. Drag to look around." />
      <div className="universe-world__labels">
        <div className="world-label world-label--sun" ref={setLabelRef("sun")} aria-hidden="true">
          <span className="world-label__name">Love</span>
        </div>
        {labels.map((label) => (
          <button
            key={label.id}
            ref={setLabelRef(label.id)}
            type="button"
            className="world-label"
            onClick={() => onEnter(label.id)}
          >
            <span className="world-label__name">{label.name}</span>
            <span className="world-label__whisper">{label.whisper}</span>
            {label.id === "heart-chamber" && heartHasUnread && (
              <span className="celestial__unread-badge" aria-label="Unread letter waiting" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
});
