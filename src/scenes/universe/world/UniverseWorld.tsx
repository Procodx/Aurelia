import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createWorld, type WorldController } from "./buildWorld";
import { worldObjects, type WorldObjectId } from "./worldConfig";

export type WorldLabel = { id: WorldObjectId; name: string; whisper: string };

export type UniverseWorldHandle = {
  flyTo: (id: WorldObjectId) => Promise<void>;
  flyHome: () => Promise<void>;
  dolly: (amount: number) => void;
  resetView: () => void;
};

type UniverseWorldProps = {
  labels: WorldLabel[];
  paused: boolean;
  /** Hide labels while travelling to a planet. */
  travelling: boolean;
  heartHasUnread: boolean;
  onEnter: (id: WorldObjectId) => void;
};

export const UniverseWorld = forwardRef<UniverseWorldHandle, UniverseWorldProps>(function UniverseWorld(
  { labels, paused, travelling, heartHasUnread, onEnter },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<WorldController | null>(null);
  const labelRefs = useRef(new Map<string, HTMLElement>());
  const hoverRef = useRef<WorldObjectId | null>(null);
  const onEnterRef = useRef(onEnter);

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (id) => controllerRef.current?.flyTo(id) ?? Promise.resolve(),
      flyHome: () => controllerRef.current?.flyHome() ?? Promise.resolve(),
      dolly: (amount) => controllerRef.current?.dolly(amount),
      resetView: () => controllerRef.current?.resetView(),
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
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      lowPower: (navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia("(pointer: coarse)").matches,
      onPick: (id) => onEnterRef.current(id),
      onHover: (id) => {
        hoverRef.current = id;
        labelRefs.current.forEach((element, key) => element.classList.toggle("is-hovered", key === id));
      },
      positionLabel: (id, x, y, visible) => {
        const element = labelRefs.current.get(id);
        if (!element) {
          return;
        }
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, 0)`;
        element.style.visibility = visible ? "visible" : "hidden";
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
    <div className={travelling || paused ? "universe-world is-travelling" : "universe-world"}>
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
