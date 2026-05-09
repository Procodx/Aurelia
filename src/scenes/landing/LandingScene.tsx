import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ThreeStarfield } from "../../components/ThreeStarfield";

type LandingSceneProps = {
  onEnter: () => void | Promise<void>;
};

const introLines = [
  "Some universes are born from stars...",
  "Others begin the moment one heart becomes home.",
  "This one learned your name, Aurelia.",
];

export function LandingScene({ onEnter }: LandingSceneProps) {
  const sceneRef = useRef<HTMLElement | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [canEnter, setCanEnter] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const activeLine = introLines[lineIndex] ?? "";
  const isComplete = lineIndex >= introLines.length - 1 && typedText === activeLine;

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        ".landing__veil",
        { opacity: 1 },
        { opacity: 0, duration: 3.4, ease: "power2.out", delay: 0.3 },
      );
      gsap.fromTo(
        ".landing__starfield",
        { opacity: 0, scale: 1.08, filter: "blur(7px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 5.6, ease: "sine.out", delay: 1.1 },
      );
      gsap.fromTo(
        ".landing__copy",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1.8, ease: "power2.out", delay: 2.2 },
      );
    }, sceneRef);

    return () => context.revert();
  }, []);

  useEffect(() => {
    setTypedText("");
    let characterIndex = 0;
    const typingDelay = lineIndex === 2 ? 118 : 96;
    const intervalId = window.setInterval(() => {
      characterIndex += 1;
      setTypedText(activeLine.slice(0, characterIndex));

      if (characterIndex >= activeLine.length) {
        window.clearInterval(intervalId);
        if (lineIndex < introLines.length - 1) {
          window.setTimeout(() => setLineIndex((current) => current + 1), lineIndex === 0 ? 1900 : 2200);
        }
      }
    }, typingDelay);

    return () => window.clearInterval(intervalId);
  }, [activeLine, lineIndex]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCanEnter(true), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [isComplete]);

  const handleEnter = () => {
    if (isEntering) {
      return;
    }

    setIsEntering(true);
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "expo.inOut" },
      });

      timeline
        .to(".landing__copy", { opacity: 0, y: -36, filter: "blur(10px)", duration: 0.85 }, 0)
        .to(".entry p", { opacity: 0, y: 16, duration: 0.45 }, 0)
        .to(".landing__starfield", { scale: 1.42, opacity: 0.9, duration: 2.1 }, 0)
        .to(".entry__star", { scale: 18, duration: 2.05 }, 0.1)
        .to(".entry__core", { opacity: 1, boxShadow: "0 0 90px rgba(255,248,217,1), 0 0 240px rgba(255,215,132,0.92)", duration: 1.4 }, 0.1)
        .to(".star-tunnel", { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.15 }, 0.24)
        .to(".star-tunnel", { opacity: 0.18, scale: 2.8, duration: 0.85 }, 1.28)
        .to(".landing__veil", { opacity: 1, duration: 0.48, ease: "power2.in" }, 1.85);
    }, sceneRef);

    window.setTimeout(() => {
      void onEnter();
    }, 2200);
    window.setTimeout(() => context.revert(), 2800);
  };

  const whispers = useMemo(
    () => ["Aligning stars", "Gathering soft light", "Opening the quiet sky"],
    [],
  );

  return (
    <motion.section
      ref={sceneRef}
      className="landing scene"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 1.45, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="landing__veil" />
      <div className="star-tunnel" />
      <ThreeStarfield className="three-starfield landing__starfield" intensity="quiet" density={900} depth={700} />
      <div className="cosmic-haze cosmic-haze--violet" />
      <div className="cosmic-haze cosmic-haze--gold" />

      <div className="landing__copy" aria-live="polite">
        <p className="landing__whisper">{whispers[lineIndex]}</p>
        <h1>{typedText}<span className="typing-caret" /></h1>
      </div>

      {canEnter && (
        <motion.div
          className="entry"
          initial={{ opacity: 0, scale: 0.78, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            className={isEntering ? "entry__star is-entering" : "entry__star"}
            type="button"
            onClick={handleEnter}
            aria-label="Enter Aurelia's universe"
            disabled={isEntering}
          >
            <span className="entry__core" />
            <span className="entry__halo" />
            <span className="entry__ring entry__ring--one" />
            <span className="entry__ring entry__ring--two" />
          </button>
          <p>{isEntering ? "The star is opening..." : "Touch the first star."}</p>
        </motion.div>
      )}
    </motion.section>
  );
}
