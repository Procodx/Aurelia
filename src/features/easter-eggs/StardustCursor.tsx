import { useEffect, useRef } from "react";

type Dust = {
  x: number;
  y: number;
  size: number;
  life: number;
  hue: number;
};

export function StardustCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const dust: Dust[] = [];
    let animationId = 0;
    let lastSpawn = 0;
    let isDrawing = false;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = () => {
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

      if (dust.length > 0) {
        animationId = window.requestAnimationFrame(draw);
        return;
      }

      isDrawing = false;
    };

    const startDrawing = () => {
      if (isDrawing) {
        return;
      }

      isDrawing = true;
      animationId = window.requestAnimationFrame(draw);
    };

    const pointerMove = (event: PointerEvent) => {
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

      startDrawing();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", pointerMove);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointerMove);
    };
  }, []);

  return <canvas className="stardust-cursor" ref={canvasRef} aria-hidden="true" />;
}
