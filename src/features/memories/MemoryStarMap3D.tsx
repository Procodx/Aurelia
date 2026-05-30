import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import type { MemoryMoment } from "./memoryData";

type MemoryStarMap3DProps = {
  moments: MemoryMoment[];
  activeId: string;
  onSelect: (id: string) => void;
};

type StarConfig = {
  id: string;
  title: string;
  eyebrow: string;
  pullQuote: string;
  color: string;
  position: THREE.Vector3;
};

const toneColors: Record<MemoryMoment["tone"], string> = {
  blue: "#8fd6ff",
  gold: "#ffd784",
  rose: "#ff9ab3",
  violet: "#d9b8ff",
};

const basePositions = [
  new THREE.Vector3(-1.75, 0.82, 0.04),
  new THREE.Vector3(-0.46, 1.28, -0.34),
  new THREE.Vector3(0.58, 0.32, 0.2),
  new THREE.Vector3(1.42, -0.72, -0.12),
  new THREE.Vector3(0.2, -1.24, 0.28),
];

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.2, "rgba(255, 248, 220, 0.74)");
  gradient.addColorStop(0.48, "rgba(255, 215, 132, 0.2)");
  gradient.addColorStop(1, "rgba(255, 215, 132, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function getFallbackPosition(index: number) {
  const angle = index * 1.82;
  const radius = 1.1 + index * 0.15;
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, Math.sin(angle * 0.7) * 0.34);
}

export function MemoryStarMap3D({ moments, activeId, onSelect }: MemoryStarMap3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef(activeId);
  const hoverIdRef = useRef<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const stars = useMemo<StarConfig[]>(
    () =>
      moments.map((moment, index) => ({
        id: moment.id,
        title: moment.title,
        eyebrow: moment.eyebrow,
        pullQuote: moment.pullQuote,
        color: toneColors[moment.tone],
        position: (basePositions[index] ?? getFallbackPosition(index)).clone(),
      })),
    [moments],
  );

  const activeStar = stars.find((star) => star.id === activeId) ?? stars[0];
  const previewStar = stars.find((star) => star.id === hoveredId) ?? activeStar;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const mapElement = mapRef.current;
    if (!canvas || !mapElement || stars.length === 0) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    const group = new THREE.Group();
    const starMeshes: THREE.Mesh[] = [];
    const glowSprites: THREE.Sprite[] = [];
    const focusTarget = new THREE.Vector3();
    const pointer = new THREE.Vector2();
    const smoothPointer = new THREE.Vector2();
    const rayPointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const glowTexture = createGlowTexture();
    const sphereGeometry = new THREE.SphereGeometry(0.065, 20, 12);

    camera.position.set(0, 0.15, 5.8);
    scene.add(group);

    const dustCount = 150;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustPalette = ["#fff8db", "#8fd6ff", "#d9b8ff", "#ffd784"].map((color) => new THREE.Color(color));
    for (let index = 0; index < dustCount; index += 1) {
      const i3 = index * 3;
      dustPositions[i3] = (Math.random() - 0.5) * 6.4;
      dustPositions[i3 + 1] = (Math.random() - 0.5) * 4;
      dustPositions[i3 + 2] = (Math.random() - 0.5) * 2.2 - 0.2;
      const color = dustPalette[Math.floor(Math.random() * dustPalette.length)];
      dustColors[i3] = color.r;
      dustColors[i3 + 1] = color.g;
      dustColors[i3 + 2] = color.b;
    }

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
    const dustMaterial = new THREE.PointsMaterial({
      size: 0.018,
      transparent: true,
      opacity: 0.58,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    group.add(dust);

    const linePositions: number[] = [];
    for (let index = 0; index < stars.length - 1; index += 1) {
      linePositions.push(...stars[index].position.toArray(), ...stars[index + 1].position.toArray());
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: "#ffd784",
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
    });
    const constellationLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(constellationLines);

    stars.forEach((star) => {
      const color = new THREE.Color(star.color);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(sphereGeometry, material);
      mesh.position.copy(star.position);
      mesh.userData.id = star.id;
      group.add(mesh);
      starMeshes.push(mesh);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.copy(star.position);
      glow.scale.setScalar(0.72);
      group.add(glow);
      glowSprites.push(glow);
    });

    const resize = () => {
      const { clientWidth, clientHeight } = mapElement;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };

    const moveCameraTo = (id: string, immediate = false) => {
      const star = stars.find((item) => item.id === id) ?? stars[0];
      const cameraTarget = star.position.clone().add(new THREE.Vector3(0.22, 0.04, 3.35));
      const duration = immediate ? 0 : 1.05;
      gsap.to(camera.position, {
        x: cameraTarget.x,
        y: cameraTarget.y,
        z: cameraTarget.z,
        duration,
        ease: "power3.inOut",
      });
      gsap.to(focusTarget, {
        x: star.position.x,
        y: star.position.y,
        z: star.position.z,
        duration,
        ease: "power3.inOut",
      });
    };

    const handleFocusEvent = (event: Event) => {
      const nextActiveId = (event as CustomEvent<string>).detail;
      if (typeof nextActiveId === "string") {
        moveCameraTo(nextActiveId);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * -2;
      rayPointer.copy(pointer);
      raycaster.setFromCamera(rayPointer, camera);
      const [hit] = raycaster.intersectObjects(starMeshes, false);
      const nextHoverId = typeof hit?.object.userData.id === "string" ? hit.object.userData.id : null;
      if (hoverIdRef.current !== nextHoverId) {
        hoverIdRef.current = nextHoverId;
        setHoveredId(nextHoverId);
        canvas.style.cursor = nextHoverId ? "pointer" : "grab";
      }
    };

    const handlePointerDown = () => {
      if (hoverIdRef.current) {
        onSelect(hoverIdRef.current);
      }
    };

    const handlePointerLeave = () => {
      hoverIdRef.current = null;
      setHoveredId(null);
      canvas.style.cursor = "grab";
    };

    let frameId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      smoothPointer.lerp(pointer, 0.045);
      group.rotation.y = Math.sin(elapsed * 0.14) * 0.08 + smoothPointer.x * 0.12;
      group.rotation.x = Math.cos(elapsed * 0.12) * 0.035 - smoothPointer.y * 0.07;
      dust.rotation.z = elapsed * 0.012;
      constellationLines.rotation.z = Math.sin(elapsed * 0.1) * 0.015;

      starMeshes.forEach((mesh, index) => {
        const id = mesh.userData.id as string;
        const isActive = id === activeIdRef.current;
        const isHovered = id === hoverIdRef.current;
        const pulse = 1 + Math.sin(elapsed * 2.1 + index * 0.62) * 0.08;
        const targetScale = isActive ? 1.75 : isHovered ? 1.45 : 1;
        mesh.scale.lerp(new THREE.Vector3(targetScale * pulse, targetScale * pulse, targetScale * pulse), 0.08);
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity = isActive || isHovered ? 1 : 0.76;
        const glow = glowSprites[index];
        glow.scale.setScalar((isActive ? 1.18 : isHovered ? 0.96 : 0.68) + Math.sin(elapsed * 1.8 + index) * 0.04);
        (glow.material as THREE.SpriteMaterial).opacity = isActive ? 0.88 : isHovered ? 0.7 : 0.42;
      });

      lineMaterial.opacity = hoverIdRef.current ? 0.68 : 0.44 + Math.sin(elapsed * 1.4) * 0.07;
      camera.lookAt(focusTarget);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    moveCameraTo(activeIdRef.current, true);
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("aurelia:memory-star-focus", handleFocusEvent);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("aurelia:memory-star-focus", handleFocusEvent);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      gsap.killTweensOf([camera.position, focusTarget]);
      sphereGeometry.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      glowTexture.dispose();
      starMeshes.forEach((mesh) => {
        (mesh.material as THREE.Material).dispose();
      });
      glowSprites.forEach((sprite) => {
        (sprite.material as THREE.Material).dispose();
      });
      renderer.dispose();
    };
  }, [onSelect, stars]);

  useEffect(() => {
    const event = new CustomEvent("aurelia:memory-star-focus", { detail: activeId });
    window.dispatchEvent(event);
  }, [activeId]);

  return (
    <section className="memory-star-map" ref={mapRef} aria-label="3D memory constellation">
      <canvas ref={canvasRef} className="memory-star-map__canvas" aria-hidden="true" />
      <div className="memory-star-map__vignette" aria-hidden="true" />
      <div className="memory-star-map__copy">
        <p>{previewStar.eyebrow}</p>
        <h3>{previewStar.title}</h3>
        <span>{previewStar.pullQuote}</span>
      </div>
      <div className="memory-star-map__selector" aria-label="Choose a memory star">
        {stars.map((star) => (
          <button
            type="button"
            className={star.id === activeId ? "is-active" : ""}
            key={star.id}
            onClick={() => onSelect(star.id)}
            style={{ "--star-color": star.color } as CSSProperties}
          >
            <span />
            {star.eyebrow}
          </button>
        ))}
      </div>
    </section>
  );
}
