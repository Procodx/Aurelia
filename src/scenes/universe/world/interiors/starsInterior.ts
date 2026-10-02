import * as THREE from "three";
import { createInteriorBase, disposeScene, type Interior, type InteriorContext } from "./interiorKit";

// Inside a constellation: she floats among thousands of stars joined by thin
// lines of light. `dim` makes the stars of memories that have not happened yet.
export function createStarsInterior(context: InteriorContext, dim = false): Interior {
  const base = createInteriorBase({
    ...context,
    sky: dim
      ? { band: "#4a5686", warm: "#8a8fae", cool: "#1e2850", cloud: "#4a4f80", base: [3, 4, 12], strength: 0.55 }
      : { band: "#5a82e0", warm: "#e8c890", cool: "#2a46a0", cloud: "#9a6adc", base: [2, 4, 16], strength: 0.85 },
    stars: 2200,
  });
  const { scene, glow } = base;

  const cluster = new THREE.Group();
  scene.add(cluster);

  const count = context.lowPower ? 60 : 110;
  const stars: THREE.Vector3[] = [];
  const palette = dim ? ["#aab4d8", "#8e98c0"] : ["#fff2c4", "#cfe4ff", "#ffd9a0", "#e2cfff"];
  for (let i = 0; i < count; i += 1) {
    const direction = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.9, Math.random() - 0.5).normalize();
    const distance = 48 + Math.random() * 90;
    const position = direction.multiplyScalar(distance);
    // Keep the area right in front of her clear for the content she looks at.
    if (position.z < 0 && Math.abs(position.x) < 14 && Math.abs(position.y) < 12 && distance < 70) {
      position.multiplyScalar(1.6);
    }
    stars.push(position);
    const star = glow(palette[i % palette.length], (dim ? 3.2 : 4.5) + Math.random() * 5, dim ? 0.55 : 1);
    star.position.copy(position);
    cluster.add(star);
  }

  // Link each star to its two nearest neighbours.
  const points: THREE.Vector3[] = [];
  stars.forEach((star, index) => {
    const nearest = stars
      .map((other, otherIndex) => ({ other, otherIndex, d: star.distanceToSquared(other) }))
      .filter((entry) => entry.otherIndex !== index)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    nearest.forEach((entry) => points.push(star, entry.other));
  });
  cluster.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: dim ? "#8e98c0" : "#ffd784", transparent: true, opacity: dim ? 0.18 : 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
    ),
  );

  // Great soft clouds of colour.
  const tints = dim ? ["#4a5686", "#3a4470"] : ["#5a82e0", "#9a6adc", "#e8a070", "#4ac0c0"];
  tints.forEach((tint, index) => {
    const cloud = glow(tint, 220 + index * 40, dim ? 0.22 : 0.3);
    const angle = (index / tints.length) * Math.PI * 2 + 0.6;
    cloud.position.set(Math.cos(angle) * 190, (index % 2 ? 40 : -30), Math.sin(angle) * 190);
    scene.add(cloud);
  });

  const dust = base.particles(context.lowPower ? 90 : 180, { radius: 100, minY: -40, maxY: 40 }, dim ? "#aab4d8" : "#ffe9c4", 1.2, 0.35);

  return {
    scene,
    spawn: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    flash: dim ? "#c8d0ec" : "#bcd8ff",
    update: (delta, elapsed) => {
      base.tick(elapsed);
      dust(delta, elapsed);
      cluster.rotation.y += delta * 0.012;
    },
    dispose: () => disposeScene(scene),
  };
}
