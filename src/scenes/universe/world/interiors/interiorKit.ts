import * as THREE from "three";
import { createGlowTexture, createSkyTexture, fbm3, type SkyPalette } from "../proceduralTextures";
import { starShell } from "../starShell";

// A world's interior: what she sees after diving through its atmosphere. It is
// its own scene (own sky, ground and lights) that the camera moves into.
export type Interior = {
  scene: THREE.Scene;
  /** Where she lands, and which way she is looking (the content sits in front of her). */
  spawn: { x: number; y: number; z: number; yaw: number; pitch: number };
  /** Colour of the flash used when diving in and out. */
  flash: string;
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
};

export type InteriorContext = {
  lowPower: boolean;
  pixelRatio: number;
};

export function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    const target = object as THREE.Mesh;
    target.geometry?.dispose();
    const materials = Array.isArray(target.material) ? target.material : target.material ? [target.material] : [];
    for (const material of materials) {
      const withMaps = material as THREE.Material & Record<string, unknown>;
      for (const key of ["map", "emissiveMap", "alphaMap"]) {
        (withMaps[key] as THREE.Texture | undefined)?.dispose?.();
      }
      material.dispose();
    }
  });
}

type BaseOptions = InteriorContext & {
  sky: SkyPalette;
  fog?: { color: string; density: number };
  stars?: number;
  hemisphere?: { sky: string; ground: string; intensity: number };
};

export function createInteriorBase(options: BaseOptions) {
  const { lowPower, pixelRatio, sky, fog } = options;
  const scene = new THREE.Scene();
  if (fog) {
    scene.fog = new THREE.FogExp2(fog.color, fog.density);
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 40, 28),
    new THREE.MeshBasicMaterial({ map: createSkyTexture(512, 256, sky), side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  scene.add(dome);

  const stars = starShell(Math.round((options.stars ?? 1800) * (lowPower ? 0.55 : 1)), 600, 850, [1.1, 4.2], pixelRatio);
  scene.add(stars);

  if (options.hemisphere) {
    scene.add(new THREE.HemisphereLight(options.hemisphere.sky, options.hemisphere.ground, options.hemisphere.intensity));
  }

  const glowTexture = createGlowTexture();

  const glow = (color: string, scale: number, opacity = 1) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    sprite.scale.setScalar(scale);
    return sprite;
  };

  /** Soft drifting points: rising (embers, notes), falling (petals) or hovering (fireflies). */
  const particles = (count: number, area: { radius: number; minY: number; maxY: number }, color: string, size: number, velocity: number) => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.sqrt(Math.random()) * area.radius;
      positions.set([Math.cos(angle) * radius, area.minY + Math.random() * (area.maxY - area.minY), Math.sin(angle) * radius], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size, map: glowTexture, color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    scene.add(points);

    return (delta: number, elapsed: number) => {
      const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        let y = attr.getY(i) + velocity * delta;
        if (velocity > 0 && y > area.maxY) y = area.minY;
        if (velocity < 0 && y < area.minY) y = area.maxY;
        attr.setXYZ(i, attr.getX(i) + Math.sin(elapsed * 0.5 + i) * delta * 0.6, y, attr.getZ(i) + Math.cos(elapsed * 0.4 + i * 1.3) * delta * 0.6);
      }
      attr.needsUpdate = true;
    };
  };

  const tick = (elapsed: number) => {
    (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    dome.rotation.y += 0.00006;
  };

  return { scene, glow, glowTexture, particles, tick, lowPower, pixelRatio };
}

/** A square noise texture used for terrain, stretched across a disc. */
export function createTerrainTexture(
  size: number,
  colorAt: (n: number, detail: number, x: number, y: number) => [number, number, number],
  scale = 3,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const n = fbm3(u * scale, v * scale, 0.5, 5);
      const detail = fbm3(u * scale * 6 + 9, v * scale * 6, 1.5, 3);
      const [r, g, b] = colorAt(n, detail, u, v);
      const i = (y * size + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function discGround(radius: number, texture: THREE.Texture, options: { roughness?: number; emissive?: string; emissiveIntensity?: number } = {}) {
  const geometry = new THREE.CircleGeometry(radius, 72);
  geometry.rotateX(-Math.PI / 2);
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: options.roughness ?? 1,
      metalness: 0,
      emissive: new THREE.Color(options.emissive ?? "#000000"),
      emissiveMap: options.emissive ? texture : null,
      emissiveIntensity: options.emissiveIntensity ?? 0,
    }),
  );
}
