import * as THREE from "three";
import { createGlowTexture, createPlanetTexture } from "../proceduralTextures";
import { createInteriorBase, createTerrainTexture, discGround, disposeScene, type Interior, type InteriorContext } from "./interiorKit";

// On the surface of the Echo Moon: pale cratered ground under a black sky, a
// glowing green world rising on the horizon, and a stage where the music lives.
export function createEchoInterior(context: InteriorContext): Interior {
  const base = createInteriorBase({
    ...context,
    sky: { band: "#8294e0", warm: "#d4dcff", cool: "#2b3f8c", cloud: "#6a7fd0", base: [1, 2, 9], strength: 0.75 },
    fog: { color: "#05071a", density: 0.0014 },
    hemisphere: { sky: "#8aa0e8", ground: "#262a4a", intensity: 0.45 },
  });
  const { scene, glow } = base;

  scene.add(
    discGround(
      600,
      createTerrainTexture(context.lowPower ? 384 : 640, (n, detail, u, v) => {
        // Craters: bright rims around dark bowls.
        const crater = Math.abs(Math.sin(u * 52 + n * 6) * Math.sin(v * 52 + n * 5));
        const shade = 36 + n * 110 + (detail - 0.5) * 70 - (crater < 0.09 ? 34 : 0);
        return [Math.max(shade, 8) * 0.92, Math.max(shade, 8) * 0.97, Math.max(shade, 8) * 1.14];
      }, 4),
      { roughness: 1 },
    ),
  );

  const sunLight = new THREE.DirectionalLight("#fff0da", 1.5);
  sunLight.position.set(-120, 90, -60);
  scene.add(sunLight);

  // A distant green world with a thin atmosphere.
  const earth = new THREE.Mesh(new THREE.SphereGeometry(58, 48, 32), new THREE.MeshStandardMaterial({ map: createPlanetTexture("garden", 384, 192), roughness: 1, emissive: "#3a8a66", emissiveIntensity: 0.25 }));
  earth.position.set(-190, 110, -340);
  const earthGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: createGlowTexture(), color: "#7be8c0", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  earthGlow.scale.setScalar(190);
  earthGlow.position.copy(earth.position);
  scene.add(earth, earthGlow);

  // The stage: a glowing record laid into the ground.
  const stageCanvas = document.createElement("canvas");
  stageCanvas.width = 512;
  stageCanvas.height = 512;
  const sctx = stageCanvas.getContext("2d")!;
  const vinyl = sctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  vinyl.addColorStop(0, "#222638");
  vinyl.addColorStop(1, "#080a14");
  sctx.fillStyle = vinyl;
  sctx.fillRect(0, 0, 512, 512);
  sctx.strokeStyle = "rgba(190, 210, 255, 0.28)";
  sctx.lineWidth = 2;
  for (let r = 70; r < 250; r += 9) {
    sctx.beginPath();
    sctx.arc(256, 256, r, 0, Math.PI * 2);
    sctx.stroke();
  }
  sctx.fillStyle = "#7a8cff";
  sctx.beginPath();
  sctx.arc(256, 256, 56, 0, Math.PI * 2);
  sctx.fill();
  const stageTexture = new THREE.CanvasTexture(stageCanvas);
  stageTexture.colorSpace = THREE.SRGBColorSpace;
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 22, 1, 64),
    [
      new THREE.MeshStandardMaterial({ color: "#aab8ff", emissive: "#6f86ff", emissiveIntensity: 0.9 }),
      new THREE.MeshStandardMaterial({ map: stageTexture, emissive: "#5a6cd8", emissiveMap: stageTexture, emissiveIntensity: 0.6, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: "#222a55" }),
    ],
  );
  stage.position.set(0, 0.5, -52);
  scene.add(stage);

  // Light posts around the stage.
  const posts: THREE.Mesh[] = [];
  const postGeometry = new THREE.SphereGeometry(0.5, 12, 10);
  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2;
    const post = new THREE.Mesh(postGeometry, new THREE.MeshBasicMaterial({ color: "#c8d4ff", fog: false }));
    post.position.set(Math.cos(angle) * 30, 1, -52 + Math.sin(angle) * 30);
    scene.add(post);
    posts.push(post);
  }
  const stageGlow = glow("#7f92ff", 110, 0.5);
  stageGlow.position.set(0, 6, -52);
  scene.add(stageGlow);

  const songs = base.particles(context.lowPower ? 90 : 180, { radius: 60, minY: 0, maxY: 40 }, "#bfe4ff", 1.5, 1.8);

  return {
    scene,
    spawn: { x: 0, y: 6, z: 0, yaw: 0, pitch: -0.02 },
    flash: "#d4e2ff",
    update: (delta, elapsed) => {
      base.tick(elapsed);
      songs(delta, elapsed);
      earth.rotation.y += delta * 0.03;
      stage.rotation.y += delta * 0.18;
      posts.forEach((post, index) => post.scale.setScalar(1 + Math.sin(elapsed * 2 + index) * 0.25));
      stageGlow.material.opacity = 0.42 + Math.sin(elapsed * 1.4) * 0.1;
    },
    dispose: () => disposeScene(scene),
  };
}
