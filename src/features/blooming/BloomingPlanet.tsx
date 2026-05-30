import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { complimentReflections, fallbackComplimentReflection } from "./bloomingCopy";

type BloomingPlanetProps = {
  onClose: () => void;
};

type ComplimentImage = {
  id: string;
  title: string;
  fileName: string;
  source: string;
};

type ComplimentLibrary = {
  compliments?: ComplimentImage[];
};

export function BloomingPlanet({ onClose }: BloomingPlanetProps) {
  const [compliments, setCompliments] = useState<ComplimentImage[]>([]);
  const [activeId, setActiveId] = useState("");
  const activeCompliment = compliments.find((compliment) => compliment.id === activeId) ?? compliments[0] ?? null;
  const activeReflection = activeCompliment
    ? complimentReflections[activeCompliment.id] ?? fallbackComplimentReflection
    : fallbackComplimentReflection;

  const flowerPositions = useMemo(
    () =>
      compliments.map((compliment, index) => ({
        id: compliment.id,
        x: 10 + ((index * 31) % 78),
        y: 15 + ((index * 47) % 70),
        delay: index * 0.12,
      })),
    [compliments],
  );

  useEffect(() => {
    let isMounted = true;

    const loadCompliments = async () => {
      try {
        const response = await fetch(`/memories/compliments.json?updated=${Date.now()}`);
        if (!response.ok) {
          throw new Error("Compliment gallery not found");
        }

        const library = (await response.json()) as ComplimentLibrary;
        const nextCompliments = Array.isArray(library.compliments) ? library.compliments : [];
        if (!isMounted) {
          return;
        }

        setCompliments(nextCompliments);
        setActiveId((current) =>
          nextCompliments.some((compliment) => compliment.id === current) ? current : nextCompliments[0]?.id ?? "",
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setCompliments([]);
        setActiveId("");
      }
    };

    void loadCompliments();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <motion.aside
      className="blooming-planet"
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.99 }}
      transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
      aria-label="The Blooming Planet"
    >
      <button className="blooming-planet__close" type="button" onClick={onClose} aria-label="Return to universe">
        Return
      </button>

      <div className="blooming-planet__scroller">
        <header className="blooming-planet__header">
          <p>The Blooming Planet</p>
          <h2>Every flower is proof of how she loves.</h2>
          <span>
            Not just beauty. Not just sweetness. The way Aurelia knows how to love her King is the crown.
          </span>
        </header>

        <div className="blooming-planet__body">
          <section className="blooming-stage" aria-label="Selected compliment">
            <div className="blooming-stage__garden" aria-hidden="true">
              {flowerPositions.map((flower) => (
                <span
                  className={flower.id === activeCompliment?.id ? "is-active" : ""}
                  key={flower.id}
                  style={{
                    left: `${flower.x}%`,
                    top: `${flower.y}%`,
                    animationDelay: `${flower.delay}s`,
                  }}
                />
              ))}
            </div>

            {activeCompliment ? (
              <motion.img
                key={activeCompliment.id}
                src={activeCompliment.source}
                alt=""
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : (
              <div className="blooming-stage__empty">
                <span />
              </div>
            )}
          </section>

          <section className="blooming-reflection" aria-live="polite">
            <p>{activeReflection.eyebrow}</p>
            <h3>{activeReflection.title}</h3>
            <blockquote>{activeReflection.quote}</blockquote>
            <span>{activeReflection.body}</span>
          </section>
        </div>

        <div className="blooming-compliments" aria-label="Choose a compliment">
          {compliments.length === 0 && (
            <div className="blooming-compliments__empty">
              <strong>Waiting for the first bloom</strong>
              Add images named compliment-1.png, compliment-2.png, and so on.
            </div>
          )}

          {compliments.map((compliment) => {
            const reflection = complimentReflections[compliment.id] ?? fallbackComplimentReflection;
            return (
              <button
                className={compliment.id === activeCompliment?.id ? "is-active" : ""}
                key={compliment.id}
                type="button"
                onClick={() => setActiveId(compliment.id)}
              >
                <img src={compliment.source} alt="" />
                <span>{reflection.eyebrow}</span>
                <strong>{reflection.title}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </motion.aside>
  );
}
