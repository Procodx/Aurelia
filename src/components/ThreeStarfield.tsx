import { useEffect, useRef } from "react";
import * as THREE from "three";

type ThreeStarfieldProps = {
  density?: number;
  depth?: number;
  className?: string;
  intensity?: "quiet" | "awake";
  /**
   * When true, the render loop stops doing any work (no math, no draw call)
   * while still holding onto the WebGL context. Use this whenever the
   * starfield is fully hidden behind an overlay — it's the single biggest
   * lever for FPS since a WebGL render call is the most expensive thing
   * happening every frame.
   */
  paused?: boolean;
};

export function ThreeStarfield({
  density = 1200,
  depth = 900,
  className,
  intensity = "quiet",
  paused = false,
}: ThreeStarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2400);
    const pointer = new THREE.Vector2(0, 0);

    camera.position.z = intensity === "awake" ? 520 : 680;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, intensity === "awake" ? 1.25 : 1.5));

    const positions = new Float32Array(density * 3);
    const colors = new Float32Array(density * 3);
    const colorChoices = [
      new THREE.Color("#fff7d6"),
      new THREE.Color("#d9e7ff"),
      new THREE.Color("#e5cffd"),
      new THREE.Color("#ffdfac"),
    ];

    for (let i = 0; i < density; i += 1) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 1500;
      positions[i3 + 1] = (Math.random() - 0.5) * 900;
      positions[i3 + 2] = (Math.random() - 0.5) * depth;

      const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: intensity === "awake" ? 2.2 : 1.55,
      transparent: true,
      opacity: intensity === "awake" ? 0.82 : 0.45,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    let frameId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      if (pausedRef.current) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      const elapsed = clock.getElapsedTime();
      stars.rotation.y = elapsed * 0.008 + pointer.x * 0.035;
      stars.rotation.x = Math.sin(elapsed * 0.12) * 0.015 + pointer.y * 0.025;
      camera.position.x += (pointer.x * 28 - camera.position.x) * 0.025;
      camera.position.y += (-pointer.y * 20 - camera.position.y) * 0.025;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [density, depth, intensity]);

  return <canvas ref={canvasRef} className={className ?? "three-starfield"} aria-hidden="true" />;
}