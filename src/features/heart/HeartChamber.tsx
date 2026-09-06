import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HeartDoorScene } from "./HeartDoorScene";
import { fetchLetters, heartLettersFallback, markLetterRead, sendLetter, type HeartLetter } from "./heartLetters";
import { getStoredIdentity } from "../gate/VisitorIdentity";

type HeartChamberProps = {
  onClose: () => void;
};

type ComposeStatus = "idle" | "sending" | "sent" | "error";

export function HeartChamber({ onClose }: HeartChamberProps) {
  const identity = getStoredIdentity() ?? "henry";
  const [isOpen, setIsOpen] = useState(false);
  const [letters, setLetters] = useState<HeartLetter[]>(heartLettersFallback);
  const [activeLetterId, setActiveLetterId] = useState(heartLettersFallback[0].id);
  const [typedBody, setTypedBody] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeStatus, setComposeStatus] = useState<ComposeStatus>("idle");
  const [composeError, setComposeError] = useState("");
  const letterRef = useRef<HTMLDivElement | null>(null);
  const activeLetter = useMemo(
    () => letters.find((letter) => letter.id === activeLetterId) ?? letters[0],
    [letters, activeLetterId],
  );
  const unreadCount = useMemo(() => letters.filter((letter) => letter.isUnread).length, [letters]);
  const splineSceneUrl = import.meta.env.VITE_HEART_CHAMBER_SPLINE_SCENE;

  useEffect(() => {
    let isMounted = true;

    fetchLetters(identity)
      .then((loaded) => {
        if (!isMounted || loaded.length === 0) {
          return;
        }

        // Sort once, here, at load time — unread letters float to the top.
        // Marking one read afterwards only flips its own isUnread flag
        // (see selectLetter below); it doesn't reshuffle the list, so a
        // letter doesn't jump out from under you the moment you open it.
        const sorted = [...loaded].sort((a, b) => Number(b.isUnread) - Number(a.isUnread));
        setLetters(sorted);
        setActiveLetterId((current) =>
          sorted.some((letter) => letter.id === current) ? current : sorted[0].id,
        );
      })
      .catch(() => {
        // Already showing the fallback letters — nothing to do here.
      });

    return () => {
      isMounted = false;
    };
  }, [identity]);

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

  const selectLetter = (letter: HeartLetter) => {
    setActiveLetterId(letter.id);

    if (letter.isUnread) {
      // Reflect it as read immediately in the UI, don't wait on the network.
      setLetters((current) =>
        current.map((entry) => (entry.id === letter.id ? { ...entry, isUnread: false } : entry)),
      );
      void markLetterRead(identity, letter.id);
    }
  };

  const handleCompose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composeBody.trim().length === 0) {
      return;
    }

    setComposeStatus("sending");
    const result = await sendLetter(identity, { title: composeTitle.trim(), body: composeBody.trim() });

    if (result.ok) {
      setComposeStatus("sent");
      setComposeTitle("");
      setComposeBody("");
      window.setTimeout(() => {
        setComposeStatus("idle");
        setIsComposing(false);
      }, 1800);
    } else {
      setComposeStatus("error");
      setComposeError(result.error);
    }
  };

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
                {unreadCount > 0 && <span className="heart-chamber__badge">{unreadCount}</span>}
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
              <p>{identity === "henry" ? "Letters kept for you" : "Letters from Sir Henry"}</p>
              <h2>The Room of Slow Words</h2>
            </div>

            {!isComposing && (
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
                  <button type="button" className="heart-letter-list__compose" onClick={() => setIsComposing(true)}>
                    + Write a letter
                  </button>
                  {letters.map((letter) => (
                    <button
                      className={letter.id === activeLetterId ? "is-active" : ""}
                      key={letter.id}
                      type="button"
                      onClick={() => selectLetter(letter)}
                    >
                      <span>
                        {letter.dateLabel}
                        {letter.isUnread && <em className="heart-letter-list__unread-dot" aria-label="Unread" />}
                      </span>
                      {letter.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isComposing && (
              <motion.form
                className="heart-compose"
                onSubmit={handleCompose}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
              >
                <div className="heart-compose__header">
                  <h3>Write {identity === "henry" ? "to Aurelia" : "to Sir Henry"}</h3>
                  <button type="button" onClick={() => setIsComposing(false)} aria-label="Cancel">
                    Cancel
                  </button>
                </div>

                <input
                  type="text"
                  value={composeTitle}
                  onChange={(event) => setComposeTitle(event.target.value)}
                  placeholder="Give it a name (optional)"
                  maxLength={80}
                />

                <textarea
                  value={composeBody}
                  onChange={(event) => setComposeBody(event.target.value)}
                  placeholder="Write what you want them to find here..."
                  rows={8}
                  required
                />

                <div className="heart-compose__footer">
                  <button
                    type="submit"
                    disabled={composeStatus === "sending" || composeBody.trim().length === 0}
                  >
                    {composeStatus === "sending" ? "Sending..." : "Send letter"}
                  </button>
                  {composeStatus === "sent" && <span className="heart-compose__status is-sent">Sent 💌</span>}
                  {composeStatus === "error" && (
                    <span className="heart-compose__status is-error">{composeError}</span>
                  )}
                </div>
              </motion.form>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}