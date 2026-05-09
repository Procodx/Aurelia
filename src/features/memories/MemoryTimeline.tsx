import { useState } from "react";
import { motion } from "framer-motion";
import { memoryMoments } from "./memoryData";

type MemoryTimelineProps = {
  onClose: () => void;
};

export function MemoryTimeline({ onClose }: MemoryTimelineProps) {
  const [activeId, setActiveId] = useState(memoryMoments[0].id);
  const activeMemory = memoryMoments.find((moment) => moment.id === activeId) ?? memoryMoments[0];

  return (
    <motion.aside
      className="memory-timeline"
      initial={{ opacity: 0, y: 46, scale: 0.94, filter: "blur(18px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 28, scale: 0.98, filter: "blur(12px)" }}
      transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
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

      <div className="memory-timeline__constellation" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="memory-experience">
        <motion.section
          className={`memory-stage memory-stage--${activeMemory.artifact} memory-stage--${activeMemory.tone}`}
          key={activeMemory.id}
          initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
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

        <div className="memory-strip" aria-label="Choose a memory">
          {memoryMoments.map((moment, index) => (
            <motion.button
              type="button"
              className={
                activeMemory.id === moment.id
                  ? `memory-artifact memory-artifact--${moment.artifact} memory-artifact--${moment.tone} is-active`
                  : `memory-artifact memory-artifact--${moment.artifact} memory-artifact--${moment.tone}`
              }
              key={moment.id}
              onClick={() => setActiveId(moment.id)}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: -8, scale: 1.015 }}
              transition={{ duration: 0.72, delay: 0.18 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="memory-artifact__media">
                {moment.imageUrl ? (
                  <img src={moment.imageUrl} alt="" />
                ) : (
                  <div className="memory-artifact__placeholder">
                    <span />
                  </div>
                )}
              </div>
              <div className="memory-artifact__copy">
                <p>{moment.eyebrow}</p>
                <h3>{moment.title}</h3>
                <span>{moment.pullQuote}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
