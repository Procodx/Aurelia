import { useState } from "react";
import { motion } from "framer-motion";

type MemoryConstellationProps = {
  name: string;
  whisper: string;
  delay: number;
  drift: number;
  onOpen: () => void;
};

const points = [
  { x: 18, y: 34 },
  { x: 42, y: 18 },
  { x: 68, y: 38 },
  { x: 54, y: 68 },
  { x: 82, y: 76 },
];

const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

export function MemoryConstellation({ name, whisper, delay, drift, onOpen }: MemoryConstellationProps) {
  const [isAwake, setIsAwake] = useState(false);

  return (
    <motion.button
      className="celestial celestial--constellation memory-constellation"
      type="button"
      onClick={onOpen}
      onFocus={() => setIsAwake(true)}
      onBlur={() => setIsAwake(false)}
      onPointerEnter={() => setIsAwake(true)}
      onPointerLeave={() => setIsAwake(false)}
      initial={{ opacity: 0, scale: 0.24, y: 72, filter: "blur(18px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 1.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="celestial__body memory-constellation__body"
        animate={{
          y: [0, -16, 0, 10, 0],
          rotate: [0, 1.4, 0, -1.2, 0],
          scale: [1, 1.035, 1, 0.99, 1],
        }}
        transition={{
          duration: 8.5,
          repeat: Infinity,
          delay: drift,
          ease: [0.42, 0, 0.58, 1],
        }}
      >
        <svg className="memory-constellation__map" viewBox="0 0 100 100" aria-hidden="true">
          <motion.path
            d={linePath}
            fill="none"
            stroke="rgba(255, 215, 132, 0.72)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: isAwake ? 1 : 0, opacity: isAwake ? 1 : 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          {points.map((point, index) => (
            <motion.circle
              key={`${point.x}-${point.y}`}
              cx={point.x}
              cy={point.y}
              r={index === 2 ? 4.4 : 3.3}
              animate={{
                opacity: isAwake ? [0.7, 1, 0.82] : [0.45, 0.82, 0.45],
                scale: isAwake ? [1, 1.25, 1] : [0.94, 1.06, 0.94],
              }}
              transition={{
                duration: isAwake ? 1.2 : 2.8,
                repeat: Infinity,
                delay: index * 0.13,
                ease: "easeInOut",
              }}
            />
          ))}
        </svg>
      </motion.span>
      <span className="celestial__aura" />
      <span className="celestial__name">{name}</span>
      <span className="celestial__whisper">{isAwake ? "The stars are remembering. Come closer." : whisper}</span>
    </motion.button>
  );
}

