import { useEffect, useRef } from "react";
import gsap from "gsap";

type Dust = {
  x: number;
  y: number;
  size: number;
  life: number;
  hue: number;
};

type StardustCursorProps = {
  /**
   * When true, stop spawning new dust and stop drawing entirely — used
   * while a planet panel (Heart Chamber, Echo Moon, etc.) covers the
   * screen, so this canvas isn't doing pointless work behind an overlay.
   */
  paused?: boolean;
};

export function StardustCursor({ paused = false }: StardustCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const dust: Dust[] = [];
    let lastSpawn = 0;
    let hadDustLastFrame = false;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    // Driven by GSAP's shared ticker instead of its own requestAnimationFrame
    // registration. GSAP already runs one rAF loop for every warp/entry
    // animation in the app; piggybacking here means the browser schedules
    // one callback per frame instead of two competing ones, and this
    // function is a no-op cost (one array-length check) whenever there's
    // no dust on screen, rather than an idle rAF loop ticking forever.
    const draw = () => {
      if (pausedRef.current || dust.length === 0) {
        if (hadDustLastFrame) {
          context.clearRect(0, 0, window.innerWidth, window.innerHeight);
          hadDustLastFrame = false;
        }
        return;
      }

      hadDustLastFrame = true;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = dust.length - 1; i >= 0; i -= 1) {
        const particle = dust[i];
        particle.life -= 0.018;
        particle.y -= 0.16;

        if (particle.life <= 0) {
          dust.splice(i, 1);
          continue;
        }

        context.beginPath();
        context.fillStyle = `hsla(${particle.hue}, 92%, 78%, ${particle.life * 0.48})`;
        context.shadowColor = `hsla(${particle.hue}, 92%, 78%, ${particle.life})`;
        context.shadowBlur = 14;
        context.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
        context.fill();
      }
    };

    const pointerMove = (event: PointerEvent) => {
      if (pausedRef.current) {
        return;
      }

      const now = performance.now();
      if (now - lastSpawn < 18) {
        return;
      }

      lastSpawn = now;
      dust.push({
        x: event.clientX,
        y: event.clientY,
        size: Math.random() * 2.4 + 0.8,
        life: 1,
        hue: [42, 220, 274][Math.floor(Math.random() * 3)],
      });
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", pointerMove);
    gsap.ticker.add(draw);

    return () => {
      gsap.ticker.remove(draw);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointerMove);
    };
  }, []);

  return <canvas className="stardust-cursor" ref={canvasRef} aria-hidden="true" />;
}