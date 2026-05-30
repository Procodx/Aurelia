import { lazy, Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";

const Spline = lazy(async () => {
  const module = await import("@splinetool/react-spline");
  return { default: module.default };
});

type HeartDoorSceneProps = {
  isOpen: boolean;
  sceneUrl?: string;
};

function CssHeartDoor() {
  return (
    <>
      <span className="heart-door__ring" />
      <span className="heart-door__gate" />
      <span className="heart-door__light" />
    </>
  );
}

export function HeartDoorScene({ isOpen, sceneUrl }: HeartDoorSceneProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const normalizedSceneUrl = useMemo(() => sceneUrl?.trim(), [sceneUrl]);
  const hasSplineScene = Boolean(normalizedSceneUrl);

  return (
    <motion.div
      className={hasSplineScene ? "heart-door heart-door--spline" : "heart-door"}
      animate={isOpen ? { scale: 1.04 } : { scale: [1, 1.025, 1] }}
      transition={isOpen ? { duration: 1 } : { duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
    >
      {hasSplineScene ? (
        <>
          <div className={isLoaded ? "heart-door__spline-stage is-loaded" : "heart-door__spline-stage"}>
            <Suspense fallback={<CssHeartDoor />}>
              <Spline scene={normalizedSceneUrl!} onLoad={() => setIsLoaded(true)} />
            </Suspense>
          </div>
          {!isLoaded && <CssHeartDoor />}
        </>
      ) : (
        <CssHeartDoor />
      )}
    </motion.div>
  );
}
