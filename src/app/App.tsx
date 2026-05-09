import { AnimatePresence, motion } from "framer-motion";
import { LandingScene } from "../scenes/landing/LandingScene";
import { UniverseScene } from "../scenes/universe/UniverseScene";
import { StardustCursor } from "../features/easter-eggs/StardustCursor";
import { useAmbientSound } from "../audio/useAmbientSound";
import { useExperienceStore } from "../store/experienceStore";

export default function App() {
  const scene = useExperienceStore((state) => state.scene);
  const activeObjectId = useExperienceStore((state) => state.activeObjectId);
  const enterUniverse = useExperienceStore((state) => state.enterUniverse);
  const { isPlaying, start, toggle } = useAmbientSound();

  const handleEnter = () => {
    void start();
    enterUniverse();
  };

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
