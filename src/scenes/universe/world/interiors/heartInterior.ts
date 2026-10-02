import * as THREE from "three";
import { createInteriorBase, createTerrainTexture, discGround, disposeScene, type Interior, type InteriorContext } from "./interiorKit";

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(13, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  return s;
}

// Inside the Heart Chamber: a vast warm hall under a rose-gold sky, with a
// great heart hanging in the air, pulsing slowly.
export function createHeartInterior(context: InteriorContext): Interior {
  const base = createInteriorBase({
    ...context,
    sky: { band: "#b04a78", warm: "#ffb894", cool: "#5a2a86", cloud: "#ff7aa0", base: [12, 4, 16], strength: 0.8 },
    fog: { color: "#1a0a20", density: 0.0026 },
    hemisphere: { sky: "#ffb0c8", ground: "#3a1440", intensity: 1.1 },
  });
  const { scene, glow } = base;

  // Floor: dark glass with glowing concentric rings.
  const floor = discGround(
    450,
    createTerrainTexture(context.lowPower ? 320 : 512, (n, detail, u, v) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const rings = Math.pow(Math.max(Math.sin(r * 46), 0), 14) * Math.max(1 - r, 0) * 1.1;
      const base = 26 + n * 36;
      return [base + rings * 255, base * 0.6 + rings * 150, base + 14 + rings * 130 + detail * 18];
    }, 2),
    { roughness: 0.35, emissive: "#ff7aa0", emissiveIntensity: 0.55 },
  );
  scene.add(floor);

  // The heart.
  const geometry = new THREE.ExtrudeGeometry(heartShape(), { depth: 4, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.4, bevelSegments: 4, curveSegments: 24 });
  geometry.center();
  const heartMaterial = new THREE.MeshStandardMaterial({ color: "#d92d5c", emissive: "#a0123c", emissiveIntensity: 0.5, roughness: 0.38, metalness: 0.1 });
  const heart = new THREE.Mesh(geometry, heartMaterial);
  heart.rotation.z = Math.PI;
  const heartHolder = new THREE.Group();
  heartHolder.position.set(0, 24, -78);
  heartHolder.scale.setScalar(1.25);
  heartHolder.add(heart);
  scene.add(heartHolder);

  const halo = glow("#ff7aa0", 90, 0.9);
  const haloWide = glow("#ffc08a", 190, 0.35);
  heartHolder.add(halo, haloWide);
  const heartLight = new THREE.PointLight("#ff8aa8", 4, 0, 0.8);
  // In front of the heart, so its face is lit and shaded instead of a flat colour.
  heartLight.position.set(18, 36, -40);
  scene.add(heartLight);

  // Pillars of light ringing the hall.
  const pillarMaterial = new THREE.MeshBasicMaterial({ color: "#ffcf9a", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const pillarGeometry = new THREE.CylinderGeometry(0.7, 1.6, 90, 10, 1, true);
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(Math.cos(angle) * 120, 44, Math.sin(angle) * 120);
    scene.add(pillar);
  }

  const risingEmbers = base.particles(context.lowPower ? 120 : 240, { radius: 110, minY: 0, maxY: 70 }, "#ffd2a0", 1.6, 2.4);

  return {
    scene,
    spawn: { x: 0, y: 6, z: 0, yaw: 0, pitch: 0.22 },
    flash: "#ffb0a8",
    update: (delta, elapsed) => {
      base.tick(elapsed);
      risingEmbers(delta, elapsed);
      // A slow heartbeat: two soft beats, then rest.
      const beat = Math.pow(Math.max(Math.sin(elapsed * 2.2), 0), 6) + Math.pow(Math.max(Math.sin(elapsed * 2.2 - 0.7), 0), 8) * 0.6;
      heartHolder.scale.setScalar(1.25 * (1 + beat * 0.07));
      heartMaterial.emissiveIntensity = 0.45 + beat * 0.6;
      halo.material.opacity = 0.7 + beat * 0.3;
      heartLight.intensity = 3.5 + beat * 3;
      heartHolder.rotation.y = Math.sin(elapsed * 0.25) * 0.5;
      heartHolder.position.y = 24 + Math.sin(elapsed * 0.6) * 1.2;
    },
    dispose: () => disposeScene(scene),
  };
}
