import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HeartDoorScene } from "./HeartDoorScene";
import { heartLetters } from "./heartLetters";

type HeartChamberProps = {
  onClose: () => void;
};

export function HeartChamber({ onClose }: HeartChamberProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLetterId, setActiveLetterId] = useState(heartLetters[0].id);
  const [typedBody, setTypedBody] = useState("");
  const letterRef = useRef<HTMLDivElement | null>(null);
  const activeLetter = useMemo(
    () => heartLetters.find((letter) => letter.id === activeLetterId) ?? heartLetters[0],
    [activeLetterId],
  );
  const splineSceneUrl = import.meta.env.VITE_HEART_CHAMBER_SPLINE_SCENE;

  useEffect(() => {
    if (!isOpen) {
      setTypedBody("");
      return;
    }

    setTypedBody("");
    let index = 0;
    const intervalId = window.setInterval(() => {
      index += 2;
      setTypedBody(activeLetter.body.slice(0, index));

      if (index >= activeLetter.body.length) {
        window.clearInterval(intervalId);
      }
    }, 28);

    return () => window.clearInterval(intervalId);
  }, [activeLetter, isOpen]);

  useEffect(() => {
    if (!letterRef.current) {
      return;
    }

    letterRef.current.scrollTop = 0;
  }, [activeLetterId, isOpen]);

  return (
    <motion.aside
      className={isOpen ? "heart-chamber is-open" : "heart-chamber"}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
      aria-label="The Heart Chamber"
    >
      <button className="heart-chamber__close" type="button" onClick={onClose} aria-label="Return to universe">
        Return
      </button>

      <div className="heart-chamber__stars" aria-hidden="true" />

      <section className="heart-chamber__threshold">
        <HeartDoorScene isOpen={isOpen} sceneUrl={splineSceneUrl} />

        <AnimatePresence>
          {!isOpen && (
            <motion.div
              className="heart-chamber__intro"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <p>The Heart Chamber</p>
              <h2>Only the Queen may enter.</h2>
              <span>
                A quiet room inside the universe, kept for letters, promises, and words that deserve to arrive slowly.
              </span>
              <button type="button" onClick={() => setIsOpen(true)}>
                Open the chamber
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {isOpen && (
          <motion.section
            className="heart-chamber__inside"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="heart-chamber__inside-header">
              <p>Letters from Sir Henry</p>
              <h2>The Room of Slow Words</h2>
            </div>

            <div className="heart-chamber__letter-stage">
              <div ref={letterRef} className="heart-letter">
                <span className="heart-letter__seal" aria-hidden="true" />
                <p>{activeLetter.dateLabel}</p>
                <h3>{activeLetter.title}</h3>
                <div className="heart-letter__body">
                  {typedBody}
                  <span className="heart-letter__caret" />
                </div>
                <strong>{activeLetter.signature}</strong>
              </div>

              <div className="heart-letter-list" aria-label="Heart Chamber letters">
                {heartLetters.map((letter) => (
                  <button
                    className={letter.id === activeLetterId ? "is-active" : ""}
                    key={letter.id}
                    type="button"
                    onClick={() => setActiveLetterId(letter.id)}
                  >
                    <span>{letter.dateLabel}</span>
                    {letter.title}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
