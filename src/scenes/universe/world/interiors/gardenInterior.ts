import * as THREE from "three";
import { createPlanetTexture } from "../proceduralTextures";
import { createInteriorBase, createTerrainTexture, discGround, disposeScene, type Interior, type InteriorContext } from "./interiorKit";

const BLOOMS = [
  { petal: "#ff9ec4", core: "#ffd987" },
  { petal: "#ffd987", core: "#ff9ec4" },
  { petal: "#b9a1ff", core: "#ffe6a8" },
  { petal: "#8fe3c0", core: "#fff1b0" },
];

function flowerTexture(petal: string, core: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(128, 128);
  const petals = 9;
  for (let i = 0; i < petals; i += 1) {
    ctx.save();
    ctx.rotate((i / petals) * Math.PI * 2);
    const gradient = ctx.createLinearGradient(0, 0, 0, -118);
    gradient.addColorStop(0, core);
    gradient.addColorStop(1, petal);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, -66, 28, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Inside the Blooming Planet: a night garden of giant glowing flowers, with
// petals drifting down and fireflies in the dark.
export function createGardenInterior(context: InteriorContext): Interior {
  const base = createInteriorBase({
    ...context,
    sky: { band: "#7a54b8", warm: "#ffb4b0", cool: "#2d3c92", cloud: "#ff8cc0", base: [8, 6, 24], strength: 0.9 },
    fog: { color: "#150f33", density: 0.0026 },
    hemisphere: { sky: "#c8b4ff", ground: "#12302c", intensity: 1.25 },
  });
  const { scene, glow } = base;

  scene.add(
    discGround(
      500,
      createTerrainTexture(context.lowPower ? 320 : 512, (n, detail) => {
        const glowPatch = Math.max(detail - 0.62, 0) * 5;
        return [14 + n * 26 + glowPatch * 90, 40 + n * 70 + glowPatch * 120, 44 + n * 50 + glowPatch * 70];
      }, 3),
      { roughness: 1 },
    ),
  );

  // A large pale moon.
  const moonTexture = createPlanetTexture("moon", 256, 128);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 40, 28), new THREE.MeshBasicMaterial({ map: moonTexture, color: "#e8eaff", fog: false }));
  moon.position.set(-150, 170, -300);
  const moonGlow = glow("#bcc8ff", 150, 0.6);
  moonGlow.position.copy(moon.position);
  scene.add(moon, moonGlow);

  // Giant flowers on tall stems.
  const stemGeometry = new THREE.CylinderGeometry(0.35, 0.6, 1, 6);
  stemGeometry.translate(0, 0.5, 0);
  const stemMaterial = new THREE.MeshStandardMaterial({ color: "#2f7a62", emissive: "#14503f", emissiveIntensity: 0.6, roughness: 0.8 });
  const flowerCount = context.lowPower ? 38 : 70;
  const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, flowerCount);
  scene.add(stems);

  const bloomMaterials = BLOOMS.map(
    (bloom) => new THREE.SpriteMaterial({ map: flowerTexture(bloom.petal, bloom.core), transparent: true, depthWrite: false, fog: false }),
  );
  const heads: { sprite: THREE.Sprite; halo: THREE.Sprite; baseScale: number; phase: number }[] = [];
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < flowerCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    // Leave a clearing around her for the things she looks at.
    const distance = 30 + Math.pow(Math.random(), 0.8) * 130;
    const height = 7 + Math.random() * 20;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    matrix.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, height, 1));
    stems.setMatrixAt(i, matrix);

    const variant = i % BLOOMS.length;
    const sprite = new THREE.Sprite(bloomMaterials[variant]);
    const size = 9 + Math.random() * 8;
    sprite.scale.setScalar(size);
    sprite.position.set(x, height + size * 0.2, z);
    const halo = glow(BLOOMS[variant].petal, size * 2.6, 0.4);
    halo.position.copy(sprite.position);
    scene.add(halo, sprite);
    heads.push({ sprite, halo, baseScale: size, phase: Math.random() * Math.PI * 2 });
  }
  stems.instanceMatrix.needsUpdate = true;

  const petals = base.particles(context.lowPower ? 110 : 220, { radius: 120, minY: 0, maxY: 50 }, "#ffb6d2", 1.8, -1.6);
  const fireflies = base.particles(context.lowPower ? 40 : 90, { radius: 90, minY: 1, maxY: 14 }, "#fff3b0", 1.1, 0.15);

  return {
    scene,
    spawn: { x: 0, y: 6, z: 0, yaw: 0, pitch: 0.06 },
    flash: "#d8ffe0",
    update: (delta, elapsed) => {
      base.tick(elapsed);
      petals(delta, elapsed);
      fireflies(delta, elapsed);
      // Flowers breathe with soft light.
      for (const head of heads) {
        const breathe = 1 + Math.sin(elapsed * 0.9 + head.phase) * 0.05;
        head.sprite.scale.setScalar(head.baseScale * breathe);
        head.halo.material.opacity = 0.32 + Math.sin(elapsed * 0.9 + head.phase) * 0.12;
      }
    },
    dispose: () => disposeScene(scene),
  };
}
