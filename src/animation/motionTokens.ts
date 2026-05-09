import type { TargetAndTransition } from "framer-motion";

export const motionTokens = {
  whisper: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  breath: { duration: 2.4, ease: "easeInOut" },
  drift: { duration: 6.5, ease: "easeInOut" },
  awakening: { duration: 7, ease: "easeOut" },
  heartOpen: { duration: 2.4, ease: [0.87, 0, 0.13, 1] },
} as const;

export const floatLoop: TargetAndTransition = {
  y: [0, -14, 0],
  scale: [1, 1.025, 1],
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: [0.42, 0, 0.58, 1],
  },
};
