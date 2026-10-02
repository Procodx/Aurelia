import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { countdownText, formatStarDate, futureStars, isLit, loadWishes, saveWish } from "./starsData";

type TomorrowsStarsProps = {
  onClose: () => void;
};

export function TomorrowsStars({ onClose }: TomorrowsStarsProps) {
  const now = useMemo(() => new Date(), []);
  const [activeId, setActiveId] = useState(
    () => futureStars.find((star) => isLit(star, now))?.id ?? futureStars[0].id,
  );
  const [wishes, setWishes] = useState(loadWishes);
  const [draft, setDraft] = useState("");
  const active = futureStars.find((star) => star.id === activeId) ?? futureStars[0];
  const lit = isLit(active, now);
  const wish = wishes[active.id];

  const makeWish = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    saveWish(active.id, text);
    setWishes((current) => ({ ...current, [active.id]: text }));
    setDraft("");
  };

  return (
    <motion.aside
      className="tomorrow-stars"
      initial={{ opacity: 0, y: 34, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 22, scale: 0.98 }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Tomorrow's Stars"
    >
      <button className="tomorrow-stars__close" type="button" onClick={onClose} aria-label="Return to universe">
        Return
      </button>

      <div className="tomorrow-stars__header">
        <p>Still on their way</p>
        <h2>Tomorrow's Stars</h2>
        <span>Each star lights up on its own day. Come back and watch the sky fill.</span>
      </div>

      <ul className="tomorrow-stars__sky">
        {futureStars.map((star) => {
          const starLit = isLit(star, now);
          return (
            <li key={star.id}>
              <button
                type="button"
                className={`future-star future-star--${star.tone} ${starLit ? "is-lit" : "is-dim"} ${
                  star.id === active.id ? "is-active" : ""
                }`}
                onClick={() => setActiveId(star.id)}
                aria-pressed={star.id === active.id}
                aria-label={`${starLit ? star.title : "A dim star"} - ${countdownText(star, now)}`}
              >
                <span className="future-star__glow" aria-hidden="true" />
                <span className="future-star__label">{starLit ? "Lit" : countdownText(star, now).replace("Lights up ", "")}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <motion.section
        key={active.id}
        className={`tomorrow-stars__card tomorrow-stars__card--${active.tone}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <p>{formatStarDate(active)}</p>
        {lit ? (
          <>
            <h3>{active.title}</h3>
            <blockquote>{active.message}</blockquote>
            {wish ? (
              <span className="tomorrow-stars__wish">You wished: “{wish}”</span>
            ) : (
              <form
                className="tomorrow-stars__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  makeWish();
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Make a wish on this star…"
                  maxLength={140}
                  aria-label="Make a wish on this star"
                  enterKeyHint="send"
                />
                <button type="submit" disabled={!draft.trim()}>
                  Wish
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h3>Not yet…</h3>
            <blockquote>{active.hint}</blockquote>
            <span className="tomorrow-stars__wish">{countdownText(active, now)}</span>
          </>
        )}
      </motion.section>
    </motion.aside>
  );
}
