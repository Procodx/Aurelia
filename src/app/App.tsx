import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { LandingScene } from "../scenes/landing/LandingScene";
import { UniverseScene } from "../scenes/universe/UniverseScene";
import { StardustCursor } from "../features/easter-eggs/StardustCursor";
import { useAmbientSound } from "../audio/useAmbientSound";
import { useExperienceStore } from "../store/experienceStore";

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
      <StardustCursor />
      <AnimatePresence mode="wait">
        {scene === "landing" ? (
          <LandingScene key="landing" onEnter={handleEnter} />
        ) : (
          <UniverseScene key="universe" />
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
