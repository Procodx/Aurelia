import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { memoryMoments } from "./memoryData";
import { MemoryStarMap3D } from "./MemoryStarMap3D";

type MemoryTimelineProps = {
  onClose: () => void;
};

export function MemoryTimeline({ onClose }: MemoryTimelineProps) {
  const [activeId, setActiveId] = useState(memoryMoments[0].id);
  const activeMemory = memoryMoments.find((moment) => moment.id === activeId) ?? memoryMoments[0];
  const selectMemory = useCallback((id: string) => setActiveId(id), []);

  return (
    <motion.aside
      className="memory-timeline"
      initial={{ opacity: 0, y: 34, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 22, scale: 0.98 }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
      aria-label="The Remembering Stars memory timeline"
    >
      <button className="memory-timeline__close" type="button" onClick={onClose} aria-label="Return to universe">
        Return
      </button>

      <div className="memory-timeline__header">
        <p>Memory Constellation</p>
        <h2>The Remembering Stars</h2>
        <span>Every bright point is a real little proof that something beautiful happened here.</span>
      </div>

      <div className="memory-experience">
        <MemoryStarMap3D moments={memoryMoments} activeId={activeMemory.id} onSelect={selectMemory} />

        <motion.section
          className={`memory-stage memory-stage--${activeMemory.artifact} memory-stage--${activeMemory.tone}`}
          key={activeMemory.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="memory-stage__media">
            {activeMemory.imageUrl ? (
              <img src={activeMemory.imageUrl} alt="" />
            ) : (
              <div className="memory-artifact__placeholder">
                <span />
              </div>
            )}
          </div>
          <div className="memory-stage__copy">
            <p>{activeMemory.eyebrow}</p>
            <h3>{activeMemory.title}</h3>
            <blockquote>{activeMemory.pullQuote}</blockquote>
            <span>{activeMemory.body}</span>
          </div>
        </motion.section>
      </div>
    </motion.aside>
  );
}
