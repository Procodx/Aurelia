import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef } from "react";
import { LandingScene } from "../scenes/landing/LandingScene";
import { SkyLoader } from "../components/SkyLoader";
import { StardustCursor } from "../features/easter-eggs/StardustCursor";
import { useAmbientSound } from "../audio/useAmbientSound";
import { useExperienceStore } from "../store/experienceStore";
import { requestTiltPermission } from "../utils/deviceTilt";

const UniverseScene = lazy(() =>
  import("../scenes/universe/UniverseScene").then((m) => ({ default: m.UniverseScene })),
);

export default function App() {
  const scene = useExperienceStore((state) => state.scene);
  const activeObjectId = useExperienceStore((state) => state.activeObjectId);
  const enterUniverse = useExperienceStore((state) => state.enterUniverse);
  const { isPlaying, start, pause, toggle } = useAmbientSound();
  const isPlayingRef = useRef(isPlaying);
  const shouldResumeBackdropRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const handleEnter = () => {
    void start();
    void requestTiltPermission();
    enterUniverse();
  };

  useEffect(() => {
    if (scene !== "universe" || isPlaying) {
      return;
    }

    const startOnInteraction = () => {
      void start();
    };

    window.addEventListener("pointerdown", startOnInteraction, { once: true });
    window.addEventListener("keydown", startOnInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    };
  }, [isPlaying, scene, start]);

  useEffect(() => {
    const pauseBackdropForForegroundAudio = () => {
      shouldResumeBackdropRef.current = shouldResumeBackdropRef.current || isPlayingRef.current;
      if (isPlayingRef.current) {
        pause();
      }
    };

    const resumeBackdropAfterForegroundAudio = () => {
      if (!shouldResumeBackdropRef.current) {
        return;
      }

      shouldResumeBackdropRef.current = false;
      void start();
    };

    window.addEventListener("aurelia:backdrop-pause", pauseBackdropForForegroundAudio);
    window.addEventListener("aurelia:backdrop-resume", resumeBackdropAfterForegroundAudio);

    return () => {
      window.removeEventListener("aurelia:backdrop-pause", pauseBackdropForForegroundAudio);
      window.removeEventListener("aurelia:backdrop-resume", resumeBackdropAfterForegroundAudio);
    };
  }, [pause, start]);

  return (
    <main className="experience-shell">
      <StardustCursor paused={activeObjectId !== null} />
      <AnimatePresence mode="wait">
        {scene === "landing" ? (
          <LandingScene key="landing" onEnter={handleEnter} />
        ) : (
          <Suspense key="universe" fallback={<SkyLoader />}>
            <UniverseScene />
          </Suspense>
        )}
      </AnimatePresence>

      {scene === "universe" && !activeObjectId && (
        <motion.button
          className="sound-orb"
          type="button"
          onClick={toggle}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 1.2 }}
          aria-label={isPlaying ? "Pause music and ambient sound" : "Play music and ambient sound"}
        >
          <span className={isPlaying ? "sound-orb__pulse is-playing" : "sound-orb__pulse"} />
        </motion.button>
      )}
    </main>
  );
}