import * as THREE from "three";
import { gsap } from "gsap";
import { createGlowTexture, createPlanetTexture, createSkyTexture } from "./proceduralTextures";
import { SUN_RADIUS, type WorldObjectDef, type WorldObjectId } from "./worldConfig";
import { createStereoRenderer, type StereoRenderer } from "./stereoRenderer";
import { starShell } from "./starShell";
import { createHeadTracker, type HeadTracker } from "./headTracking";
import { createTextSprite, createTextTexture } from "./textSprites";
import type { Viewpoint, VRPlace } from "./vrPlace";
import type { Interior } from "./interiors";

export type WorldOptions = {
  canvas: HTMLCanvasElement;
  objects: WorldObjectDef[];
  /** Display names, shown as floating 3D text in VR (DOM labels can't be seen in two eyes). */
  names: Record<WorldObjectId, string>;
  reducedMotion: boolean;
  lowPower: boolean;
  onPick: (id: WorldObjectId) => void;
  onHover: (id: WorldObjectId | null) => void;
  /** Gazed at the floating Return / Exit button in VR. */
  onDock: () => void;
  /** Called every frame so DOM labels can follow their planets. */
  /**
   * `edge` is set when the world is off-screen (behind her, above, to the side):
   * the label is then pinned to the screen edge, pointing the way, `angle` radians.
   */
  positionLabel: (id: WorldObjectId | "sun", x: number, y: number, visible: boolean, edge?: { angle: number } | null) => void;
};

export type WorldController = {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  flyTo: (id: WorldObjectId) => Promise<void>;
  flyHome: () => Promise<void>;
  dolly: (amount: number) => void;
  resetView: () => void;
  enterVR: () => void;
  exitVR: () => void;
  setDockMode: (mode: "exit" | "return") => void;
  /** Test helper: point the view straight at a world. */
  aim: (id: WorldObjectId | "dock") => void;
  /** Show (or with null, remove) a VR place such as the Heart Chamber letters. */
  setPlace: (place: VRPlace | null) => void;
  getViewpoint: () => Viewpoint;
  /** Dive through a world's atmosphere and land inside it. */
  enterInterior: (id: WorldObjectId) => Promise<void>;
  /** Rise back out of the world she is inside. */
  exitInterior: () => Promise<void>;
};

// Everything pinned to the viewer sits at the stereo convergence distance, so
// both eyes see it at the same spot (no double vision).
const VR_UI_DISTANCE = 30;
const MIN_DISTANCE = 14;
const MAX_DISTANCE = 175;

function atmosphereMaterial(color: string, strength = 1.1, power = 2.6) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uPower;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower) * uStrength;
        gl_FragColor = vec4(uColor * f, f);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export function createWorld(options: WorldOptions): WorldController {
  const { canvas, objects, reducedMotion, lowPower } = options;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPower,
    alpha: false,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x02030a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2400);
  camera.rotation.order = "YXZ";
  scene.add(camera);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  const glowTexture = track(createGlowTexture());
  const glowSprite = (color: string, scale: number, opacity = 1) => {
    const material = track(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(scale);
    return sprite;
  };

  // ---------- Sky: Milky Way / nebula backdrop and layered stars ----------
  const skyTexture = track(createSkyTexture());
  const sky = new THREE.Mesh(
    track(new THREE.SphereGeometry(1500, 48, 32)),
    track(new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, fog: false })),
  );
  scene.add(sky);

  const starScale = lowPower ? 0.55 : 1;
  const farStars = starShell(Math.round(2600 * starScale), 900, 1300, [1.1, 4.2], pixelRatio);
  const midStars = starShell(Math.round(900 * starScale), 260, 520, [1.4, 4.8], pixelRatio);
  scene.add(farStars, midStars);
  track(farStars.geometry);
  track(midStars.geometry);
  track(farStars.material as THREE.Material);
  track(midStars.material as THREE.Material);

  // Floating dust near the viewer gives a real sense of parallax and depth.
  const dustCount = lowPower ? 140 : 320;
  const dustPositions = new Float32Array(dustCount * 3);
  const DUST_BOX = 150;
  for (let i = 0; i < dustCount * 3; i += 1) {
    dustPositions[i] = (Math.random() - 0.5) * DUST_BOX * 2;
  }
  const dustGeometry = track(new THREE.BufferGeometry());
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    track(
      new THREE.PointsMaterial({
        size: 0.55,
        color: "#ffe9c4",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  scene.add(dust);

  // ---------- Lighting ----------
  const sunLight = new THREE.PointLight("#ffe0b0", 7, 0, 0.15);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight("#7080b8", 1.5));

  // ---------- Sun ("Love") ----------
  // A boiling, softly granulated surface with a bright rim, instead of a flat disc.
  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 p = normalize(vPos) * 2.6;
        float n = noise(p + uTime * 0.12) * 0.55 + noise(p * 2.3 - uTime * 0.18) * 0.3 + noise(p * 5.1 + uTime * 0.25) * 0.15;
        vec3 deep = vec3(1.0, 0.45, 0.12);
        vec3 mid = vec3(1.0, 0.72, 0.28);
        vec3 hot = vec3(1.0, 0.95, 0.72);
        vec3 color = mix(deep, mid, smoothstep(0.25, 0.6, n));
        color = mix(color, hot, smoothstep(0.55, 0.85, n));
        float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
        color += vec3(1.0, 0.55, 0.25) * rim * 0.8;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    toneMapped: false,
  });
  const sun = new THREE.Group();
  const sunBody = new THREE.Mesh(
    track(new THREE.SphereGeometry(SUN_RADIUS, 48, 32)),
    track(sunMaterial),
  );
  const sunHalo = glowSprite("#ffa83a", SUN_RADIUS * 8.5, 1);
  const sunRose = glowSprite("#ff6fa8", SUN_RADIUS * 15, 0.34);
  sun.add(sunBody, sunHalo, sunRose);
  scene.add(sun);

  // ---------- Bodies ----------
  type Body = {
    def: WorldObjectDef;
    group: THREE.Group;
    spin: THREE.Object3D | null;
    pulse: THREE.Sprite | null;
    extra: THREE.Object3D | null;
    pick: THREE.Mesh;
  };

  const pickGeometry = track(new THREE.SphereGeometry(1, 12, 8));
  const pickMaterial = track(new THREE.MeshBasicMaterial({ visible: false }));
  const bodies: Body[] = [];
  const vrOnlyObjects: THREE.Object3D[] = [];

  const addSurfaceBody = (
    def: WorldObjectDef,
    style: "garden" | "moon" | "heart",
    atmosphere: string,
    glow: string,
  ) => {
    const group = new THREE.Group();
    const texture = track(createPlanetTexture(style));
    const mesh = new THREE.Mesh(
      track(new THREE.SphereGeometry(def.radius, 56, 40)),
      track(
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: style === "moon" ? 1 : 0.82,
          metalness: 0,
          emissive: new THREE.Color(glow),
          emissiveMap: texture,
          emissiveIntensity: 0.5,
        }),
      ),
    );
    mesh.rotation.z = 0.2;
    const shell = new THREE.Mesh(
      track(new THREE.SphereGeometry(def.radius * 1.14, 40, 28)),
      track(atmosphereMaterial(atmosphere, style === "moon" ? 0.7 : 1.25, style === "moon" ? 3.2 : 2.4)),
    );
    const pulse = glowSprite(glow, def.radius * 5.2, style === "heart" ? 0.55 : 0.32);
    group.add(mesh, shell, pulse);

    let extra: THREE.Object3D | null = null;
    if (style === "moon") {
      // A thin ring of "songs" circling the moon.
      const count = 70;
      const ring = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        const wobble = 1 + Math.sin(i * 1.7) * 0.06;
        ring.set([Math.cos(angle) * def.radius * 1.9 * wobble, Math.sin(i * 2.3) * 0.18, Math.sin(angle) * def.radius * 1.9 * wobble], i * 3);
      }
      const ringGeometry = track(new THREE.BufferGeometry());
      ringGeometry.setAttribute("position", new THREE.BufferAttribute(ring, 3));
      const songs = new THREE.Points(
        ringGeometry,
        track(
          new THREE.PointsMaterial({
            size: 0.38,
            color: "#bfe4ff",
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
      songs.rotation.x = 0.5;
      group.add(songs);
      extra = songs;
    }

    return { group, spin: mesh as THREE.Object3D, pulse, extra };
  };

  const addCluster = (def: WorldObjectDef, layout: [number, number, number][], color: string, bright: boolean) => {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    const linePoints: THREE.Vector3[] = [];
    layout.forEach(([x, y, z], index) => {
      const star = glowSprite(index % 3 === 0 ? "#fff2c4" : color, bright ? 2.8 : 1.6, bright ? 1 : 0.5);
      star.position.set(x, y, z);
      inner.add(star);
      if (bright && index > 0) {
        linePoints.push(new THREE.Vector3(...layout[index - 1]), new THREE.Vector3(x, y, z));
      }
    });
    if (bright) {
      const lineGeometry = track(new THREE.BufferGeometry().setFromPoints(linePoints));
      inner.add(
        new THREE.LineSegments(
          lineGeometry,
          track(new THREE.LineBasicMaterial({ color: "#ffd784", transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })),
        ),
      );
    }
    group.add(inner, glowSprite(color, def.radius * 4.2, bright ? 0.22 : 0.1));
    return { group, spin: inner as THREE.Object3D, pulse: null, extra: null };
  };

  const memoryLayout: [number, number, number][] = [
    [-5.2, 1.5, 1.2], [-3.1, 4, -1], [-0.6, 2.2, 2], [1.8, 4.4, -0.6],
    [4.4, 2.2, 1.4], [3.2, -1.2, -1.6], [0.2, -3.6, 1], [-2.6, -1.8, -2],
  ];
  const futureLayout: [number, number, number][] = [
    [-4, 1, 0], [-1.6, 3, 1.4], [1.4, 1.6, -1.2], [3.8, -0.4, 1], [0.4, -2.6, -1.4], [-3, -2, 1.2],
  ];

  for (const def of objects) {
    let built: { group: THREE.Group; spin: THREE.Object3D | null; pulse: THREE.Sprite | null; extra: THREE.Object3D | null };
    switch (def.id) {
      case "garden-planet":
        built = addSurfaceBody(def, "garden", "#7be8c0", "#7fe3a8");
        break;
      case "echo-moon":
        built = addSurfaceBody(def, "moon", "#b8c8ff", "#c8d4ff");
        break;
      case "heart-chamber":
        built = addSurfaceBody(def, "heart", "#ff9aa8", "#ff9078");
        break;
      case "memory-constellation":
        built = addCluster(def, memoryLayout, "#9fd6ff", true);
        break;
      default:
        built = addCluster(def, futureLayout, "#8a93c4", false);
        break;
    }

    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.scale.setScalar(def.radius * 1.5);
    pick.userData.id = def.id;
    built.group.add(pick);
    scene.add(built.group);
    // Floating name for VR (hidden otherwise).
    const nameLabel = createTextSprite(options.names[def.id], def.radius * 6.2, { fontSize: 92, width: 1100 });
    nameLabel.sprite.position.set(0, -def.radius * 1.75, 0);
    nameLabel.sprite.visible = false;
    built.group.add(nameLabel.sprite);
    track(nameLabel.texture);
    track(nameLabel.material);
    vrOnlyObjects.push(nameLabel.sprite);

    bodies.push({ def, ...built, pick });
  }

  const sunName = createTextSprite("Love", SUN_RADIUS * 3.2, { fontSize: 96, width: 700 });
  sunName.sprite.position.set(0, -SUN_RADIUS * 1.5, 0);
  sunName.sprite.visible = false;
  sun.add(sunName.sprite);
  track(sunName.texture);
  track(sunName.material);
  vrOnlyObjects.push(sunName.sprite);

  // Faint orbit rings so the structure of the system reads at a glance.
  for (const def of objects) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i += 1) {
      const a = (i / 128) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(a) * def.orbitRadius,
          Math.sin(a) * def.orbitRadius * Math.sin(def.tilt),
          Math.sin(a) * def.orbitRadius * Math.cos(def.tilt),
        ),
      );
    }
    scene.add(
      new THREE.Line(
        track(new THREE.BufferGeometry().setFromPoints(points)),
        track(new THREE.LineBasicMaterial({ color: "#7f8fd6", transparent: true, opacity: 0.1, depthWrite: false })),
      ),
    );
  }

  // ---------- Shooting stars ----------
  const streak = glowSprite("#ffffff", 1, 0);
  streak.scale.set(34, 0.9, 1);
  scene.add(streak);
  let nextStreakAt = 4 + Math.random() * 4;
  let streakLife = 0;
  const streakDirection = new THREE.Vector3();

  // ---------- VR furniture: gaze reticle, welcome text, Return / Exit button ----------
  const reticle = new THREE.Group();
  reticle.position.set(0, 0, -VR_UI_DISTANCE);
  reticle.scale.setScalar(VR_UI_DISTANCE / 4);
  const reticleBase = new THREE.Mesh(
    track(new THREE.RingGeometry(0.1, 0.125, 40)),
    track(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, depthTest: false, depthWrite: false })),
  );
  const reticleDot = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.03, 16)),
    track(new THREE.MeshBasicMaterial({ color: "#fff4c8", transparent: true, depthTest: false, depthWrite: false })),
  );
  const progressMaterial = track(new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  let progressMesh: THREE.Mesh | null = null;
  let progressStep = -1;
  reticleBase.renderOrder = reticleDot.renderOrder = 1000;
  reticle.add(reticleBase, reticleDot);
  reticle.visible = false;
  camera.add(reticle);

  const setGazeProgress = (value: number) => {
    const step = Math.round(Math.min(Math.max(value, 0), 1) * 28);
    if (step === progressStep) {
      return;
    }
    progressStep = step;
    if (progressMesh) {
      reticle.remove(progressMesh);
      progressMesh.geometry.dispose();
      progressMesh = null;
    }
    if (step > 0) {
      progressMesh = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.2, 40, 1, Math.PI / 2, -(step / 28) * Math.PI * 2), progressMaterial);
      progressMesh.renderOrder = 1001;
      reticle.add(progressMesh);
    }
  };

  const welcome = createTextSprite("Slip your phone into the viewer", 5.2 * (VR_UI_DISTANCE / 4), { fontSize: 58 });
  welcome.sprite.position.set(0, 0.9 * (VR_UI_DISTANCE / 4), -VR_UI_DISTANCE);
  welcome.sprite.visible = false;
  welcome.material.depthTest = false;
  welcome.sprite.renderOrder = 999;
  camera.add(welcome.sprite);
  track(welcome.texture);
  track(welcome.material);

  const exitTexture = createTextTexture("Exit VR", { fontSize: 60, width: 640, pill: true });
  const returnTexture = createTextTexture("Return", { fontSize: 60, width: 640, pill: true });
  track(exitTexture.texture);
  track(returnTexture.texture);
  const dockMaterial = track(new THREE.MeshBasicMaterial({ map: exitTexture.texture, transparent: true, depthTest: false, depthWrite: false }));
  const dock = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1 / exitTexture.aspect)), dockMaterial);
  dock.scale.setScalar(3.6 * (VR_UI_DISTANCE / 4));
  dock.renderOrder = 998;
  dock.visible = false;
  scene.add(dock);

  // ---------- Camera rig ----------
  // She floats in the middle of the system, near the sun, with the worlds circling her.
  const pose = { x: 0, y: 2, z: 38, yaw: 0, pitch: 0 };
  const homePose = { ...pose };
  let tiltYaw = 0;
  let tiltPitch = 0;
  // On arrival the view slowly sweeps round so she sees worlds circle her; any touch ends it.
  let introSweepDone = false;
  let velYaw = 0;
  let velPitch = 0;
  let orbitTime = 0;
  let frozen = false;
  let paused = false;
  let flying = false;
  let disposed = false;

  // Which scene is on screen: the universe, or the inside of a world.
  let activeScene: THREE.Scene = scene;
  let inside = false;
  let interior: Interior | null = null;
  let interiorPromise: Promise<Interior> | null = null;
  let interiorForId: WorldObjectId | null = null;
  let savedPose: { x: number; y: number; z: number; yaw: number; pitch: number } | null = null;

  // A full-screen flash pinned to the camera, used when diving in and out.
  const flashMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
  const flashPlane = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), flashMaterial);
  flashPlane.position.set(0, 0, -1);
  flashPlane.renderOrder = 2000;
  flashPlane.frustumCulled = false;
  flashPlane.visible = false;
  camera.add(flashPlane);
  track(flashPlane.geometry);
  track(flashMaterial);
  const setFlash = (opacity: number) => {
    flashMaterial.opacity = opacity;
    flashPlane.visible = opacity > 0.002;
  };

  // VR state
  const vrHome = { x: 0, y: 2, z: 38, yaw: 0, pitch: 0 };
  let vr = false;
  let stereo: StereoRenderer | null = null;
  let head: HeadTracker | null = null;
  let vrStartedMs = 0;
  const vrSeconds = () => (performance.now() - vrStartedMs) / 1000;
  let vrRecentered = false;
  let place: VRPlace | null = null;
  let gazeId: string | null = null;
  let gazeTime = 0;
  let lastGazeAt = performance.now();
  let vignette = 0;
  const poseEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const poseQuat = new THREE.Quaternion();
  const headQuat = new THREE.Quaternion();
  const gazeRay = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);
  const GAZE_DELAY = 5;
  const baseHome = () => (vr ? vrHome : homePose);

  const applyAspect = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    if (vr) {
      // Each eye gets half the screen.
      camera.aspect = width / 2 / Math.max(height, 1);
      camera.fov = 90;
      camera.updateProjectionMatrix();
      stereo?.resize();
      return;
    }
    camera.aspect = width / Math.max(height, 1);
    const portrait = camera.aspect < 0.85;
    camera.fov = portrait ? 74 : 60;
    camera.updateProjectionMatrix();

    // The home view is the same everywhere: near the sun, looking at it.
    void portrait;
    if (!flying && !frozen) {
      pose.z = Math.min(Math.max(pose.z, MIN_DISTANCE), MAX_DISTANCE);
    }
  };
  applyAspect();
  Object.assign(pose, homePose);

  const bodyPosition = (body: Body, out: THREE.Vector3) => {
    const angle = body.def.phase + (orbitTime / body.def.orbitDuration) * Math.PI * 2;
    return out.set(
      Math.cos(angle) * body.def.orbitRadius,
      Math.sin(angle) * body.def.orbitRadius * Math.sin(body.def.tilt),
      Math.sin(angle) * body.def.orbitRadius * Math.cos(body.def.tilt),
    );
  };

  const forward = new THREE.Vector3();
  const lookDirection = () =>
    forward.set(
      -Math.sin(pose.yaw) * Math.cos(pose.pitch),
      Math.sin(pose.pitch),
      -Math.cos(pose.yaw) * Math.cos(pose.pitch),
    );

  const clampPitch = () => {
    pose.pitch = Math.min(Math.max(pose.pitch, -1.25), 1.25);
  };

  const dolly = (amount: number) => {
    introSweepDone = true;
    if (flying || frozen || vr) {
      return;
    }

    lookDirection();
    const next = new THREE.Vector3(pose.x, pose.y, pose.z).addScaledVector(forward, amount);
    const distance = next.length();
    if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
      return;
    }
    pose.x = next.x;
    pose.y = next.y;
    pose.z = next.z;
  };

  const unwrap = (from: number, to: number) => {
    let delta = to - from;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return from + delta;
  };

  const tweenPose = (target: typeof pose, duration: number, ease = "power3.inOut") =>
    new Promise<void>((resolve) => {
      const start = { ...pose };
      const yawTarget = unwrap(start.yaw, target.yaw);
      const state = { p: 0 };
      gsap.to(state, {
        p: 1,
        duration: reducedMotion ? 0.6 : duration,
        ease,
        onUpdate: () => {
          pose.x = start.x + (target.x - start.x) * state.p;
          pose.y = start.y + (target.y - start.y) * state.p;
          pose.z = start.z + (target.z - start.z) * state.p;
          pose.yaw = start.yaw + (yawTarget - start.yaw) * state.p;
          pose.pitch = start.pitch + (target.pitch - start.pitch) * state.p;
        },
        onComplete: () => resolve(),
      });
    });

  const flyTo = async (id: WorldObjectId) => {
    const body = bodies.find((item) => item.def.id === id);
    if (!body || flying) {
      return;
    }

    flying = true;
    frozen = true;
    velYaw = 0;
    velPitch = 0;
    // Build the inside of this world while the camera travels there.
    window.setTimeout(() => void prepareInterior(id), 60);

    const target = bodyPosition(body, new THREE.Vector3());
    const from = new THREE.Vector3(pose.x, pose.y, pose.z);
    const away = from.clone().sub(target).normalize();
    away.y += 0.12;
    away.normalize();
    const distance = body.def.radius * (body.def.id === "memory-constellation" || body.def.id === "future-stars" ? 4.6 : 3.7);
    const end = target.clone().addScaledVector(away, distance);

    // Look at the planet from the end pose.
    const toTarget = target.clone().sub(end).normalize();
    const endYaw = Math.atan2(-toTarget.x, -toTarget.z);
    const endPitch = Math.asin(toTarget.y);

    await tweenPose({ x: end.x, y: end.y, z: end.z, yaw: endYaw, pitch: endPitch }, 2.2);
    flying = false;
  };

  const flyHome = async () => {
    if (flying) {
      return;
    }

    if (inside) {
      await exitInterior();
    }

    flying = true;
    await tweenPose({ ...baseHome() }, 2.2);
    flying = false;
    frozen = false;
  };

  // ---------- Inside a world ----------
  const prepareInterior = (id: WorldObjectId) => {
    if (interiorPromise && interiorForId === id) {
      return interiorPromise;
    }
    interiorForId = id;
    interiorPromise = import("./interiors").then((module) => module.createInterior(id, { lowPower, pixelRatio }));
    return interiorPromise;
  };

  const swapScene = (next: THREE.Scene) => {
    activeScene = next;
    next.add(camera);
    next.add(dock);
  };

  const hideLabels = () => {
    for (const body of bodies) {
      options.positionLabel(body.def.id, -9999, -9999, false);
    }
    options.positionLabel("sun", -9999, -9999, false);
  };

  const flashTween = (from: number, to: number, duration: number, ease = "power2.inOut") =>
    new Promise<void>((resolve) => {
      const state = { value: from };
      gsap.to(state, {
        value: to,
        duration: reducedMotion ? Math.min(duration, 0.4) : duration,
        ease,
        onUpdate: () => setFlash(state.value),
        onComplete: () => resolve(),
      });
    });

  const enterInterior = async (id: WorldObjectId) => {
    const body = bodies.find((item) => item.def.id === id);
    if (!body || inside || flying) {
      return;
    }

    const built = await prepareInterior(id);
    if (disposed) {
      built.dispose();
      return;
    }
    flying = true;
    velYaw = 0;
    velPitch = 0;
    savedPose = { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch };
    flashMaterial.color.set(built.flash);

    // Dive: rush at the planet, the flash swelling over the last half.
    const planet = bodyPosition(body, new THREE.Vector3());
    const start = new THREE.Vector3(pose.x, pose.y, pose.z);
    const stop = planet.clone().add(start.clone().sub(planet).normalize().multiplyScalar(body.def.radius * 0.3));
    await new Promise<void>((resolve) => {
      const state = { p: 0 };
      gsap.to(state, {
        p: 1,
        duration: reducedMotion ? 0.5 : 1.4,
        ease: "power2.in",
        onUpdate: () => {
          pose.x = start.x + (stop.x - start.x) * state.p;
          pose.y = start.y + (stop.y - start.y) * state.p;
          pose.z = start.z + (stop.z - start.z) * state.p;
          setFlash(Math.min(Math.max((state.p - 0.4) / 0.6, 0), 1));
        },
        onComplete: () => resolve(),
      });
    });
    if (disposed) {
      return;
    }

    // Swap worlds under the flash, then land.
    interior = built;
    inside = true;
    swapScene(built.scene);
    hideLabels();
    const spawn = built.spawn;
    pose.x = spawn.x;
    pose.y = spawn.y + 24;
    pose.z = spawn.z;
    pose.yaw = spawn.yaw;
    pose.pitch = spawn.pitch;
    const landing = new Promise<void>((resolve) => {
      gsap.to(pose, { y: spawn.y, duration: reducedMotion ? 0.4 : 2.2, ease: "power3.out", onComplete: () => resolve() });
    });
    await Promise.all([flashTween(1, 0, 1.4, "power2.out"), landing]);
    flying = false;
    frozen = true;
  };

  const leaveInteriorNow = () => {
    if (!inside) {
      return;
    }
    swapScene(scene);
    interior?.dispose();
    interior = null;
    interiorPromise = null;
    interiorForId = null;
    inside = false;
    setFlash(0);
    if (savedPose) {
      Object.assign(pose, savedPose);
    }
  };

  const exitInterior = async () => {
    if (!inside || flying) {
      return;
    }
    flying = true;
    if (interior) {
      flashMaterial.color.set(interior.flash);
    }
    await flashTween(0, 1, 0.9, "power2.in");
    leaveInteriorNow();
    await flashTween(1, 0, 1, "power2.out");
    flying = false;
  };

  const resetView = () => {
    if (flying || frozen) {
      return;
    }

    flying = true;
    void tweenPose({ ...baseHome() }, 1.4).then(() => {
      flying = false;
    });
  };

  // ---------- Input: drag to look, pinch to move, tap a world to fly there ----------
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let dragMoved = 0;
  let downAt = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const lookSpeed = () => (camera.fov / 60) * 0.0042;

  const pickAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(bodies.map((body) => body.pick), false);
    return hits.length > 0 ? (hits[0].object.userData.id as WorldObjectId) : null;
  };

  const onPointerDown = (event: PointerEvent) => {
    // Inside a world she can still look around by dragging.
    if (flying || (frozen && !inside) || vr) {
      return;
    }
    introSweepDone = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      dragMoved = 0;
      downAt = performance.now();
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    }
  };

  let hoverId: WorldObjectId | null = null;
  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      if (event.pointerType === "mouse" && !flying && !frozen && !vr) {
        const id = pickAt(event.clientX, event.clientY);
        if (id !== hoverId) {
          hoverId = id;
          canvas.style.cursor = id ? "pointer" : "grab";
          options.onHover(id);
        }
      }
      return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      dolly((distance - pinchDistance) * 0.18);
      pinchDistance = distance;
      dragMoved += 10;
      return;
    }

    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    velYaw = dx * lookSpeed();
    velPitch = dy * lookSpeed();
    pose.yaw += velYaw;
    pose.pitch += velPitch;
    clampPitch();
  };

  const onPointerUp = (event: PointerEvent) => {
    const wasTracked = pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (!inside && wasTracked && pointers.size === 0 && dragMoved < 8 && performance.now() - downAt < 600) {
      velYaw = 0;
      velPitch = 0;
      const id = pickAt(event.clientX, event.clientY);
      if (id) {
        options.onPick(id);
      }
    }
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    introSweepDone = true;
    if (vr) {
      return;
    }
    dolly(-event.deltaY * 0.05);
  };

  const onTilt = (event: DeviceOrientationEvent) => {
    if (event.gamma === null || event.beta === null || reducedMotion || vr) {
      return;
    }
    tiltYaw = -Math.max(-1, Math.min(1, event.gamma / 40)) * 0.07;
    tiltPitch = -Math.max(-1, Math.min(1, (event.beta - 50) / 40)) * 0.05;
  };

  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", applyAspect);
  window.addEventListener("deviceorientation", onTilt);

  // ---------- VR (Google Cardboard) ----------
  const enterVR = () => {
    if (vr) {
      return;
    }

    vr = true;
    stereo = createStereoRenderer({ renderer, lowPower });
    head = createHeadTracker();
    camera.focus = 40;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.5));
    vrStartedMs = performance.now();
    vrRecentered = false;
    gazeId = null;
    gazeTime = 0;
    velYaw = 0;
    velPitch = 0;
    tiltYaw = 0;
    tiltPitch = 0;

    // Start her inside the system, level with the horizon.
    if (!frozen) {
      Object.assign(pose, vrHome);
    }

    reticle.visible = true;
    welcome.sprite.visible = true;
    welcome.material.opacity = 1;
    dock.visible = true;
    vrOnlyObjects.forEach((item) => (item.visible = true));
    applyAspect();
  };

  const exitVR = () => {
    if (!vr) {
      return;
    }

    vr = false;
    stereo?.dispose();
    stereo = null;
    head?.dispose();
    head = null;
    renderer.setPixelRatio(pixelRatio);
    renderer.setRenderTarget(null);
    camera.focus = 10;
    setPlace(null);
    leaveInteriorNow();
    reticle.visible = false;
    welcome.sprite.visible = false;
    dock.visible = false;
    setGazeProgress(0);
    vrOnlyObjects.forEach((item) => (item.visible = false));
    frozen = false;
    flying = false;
    camera.quaternion.identity();
    applyAspect();
    Object.assign(pose, homePose);
  };

  const setPlace = (next: VRPlace | null) => {
    if (place) {
      place.dispose();
    }
    place = next;
    if (next) {
      activeScene.add(next.group);
    }
  };

  const setDockMode = (mode: "exit" | "return") => {
    dockMaterial.map = mode === "exit" ? exitTexture.texture : returnTexture.texture;
    dockMaterial.needsUpdate = true;
  };

  const updateGaze = (_delta: number) => {
    const delta = Math.min((performance.now() - lastGazeAt) / 1000, 0.3);
    lastGazeAt = performance.now();
    if (vrSeconds() < GAZE_DELAY || flying) {
      gazeId = null;
      gazeTime = 0;
      setGazeProgress(0);
      return;
    }

    camera.updateMatrixWorld();
    dock.updateMatrixWorld(true);
    gazeRay.setFromCamera(screenCenter, camera);
    // While visiting a world, only the Return button and that place's own
    // controls are selectable.
    const placeTargets = place ? place.targets() : [];
    const targets: THREE.Object3D[] = frozen ? [dock, ...placeTargets] : [...bodies.map((body) => body.pick), dock, ...placeTargets];
    const hit = gazeRay.intersectObjects(targets, false)[0];
    const hitObject = hit ? hit.object : null;
    const id = hitObject ? (hitObject === dock ? "dock" : ((hitObject.userData.id as string | undefined) ?? hitObject.uuid)) : null;
    place?.onGaze?.(hitObject && placeTargets.includes(hitObject) ? hitObject : null);

    if (id !== gazeId) {
      gazeId = id;
      gazeTime = 0;
      setGazeProgress(0);
      return;
    }
    if (!id) {
      return;
    }

    gazeTime += delta;
    const needed = (hitObject?.userData.dwell as number | undefined) ?? (id === "dock" ? 1.6 : 1.3);
    setGazeProgress(gazeTime / needed);
    if (gazeTime >= needed) {
      gazeTime = 0;
      gazeId = null;
      setGazeProgress(0);
      const select = hitObject?.userData.onSelect as (() => void) | undefined;
      if (hitObject === dock) {
        options.onDock();
      } else if (select) {
        select();
      } else {
        options.onPick(id as WorldObjectId);
      }
    }
  };

  // ---------- Frame loop ----------
  const clock = new THREE.Clock();
  const projected = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let frameId = 0;
  let elapsed = 0;

  const project = (id: WorldObjectId | "sun", world: THREE.Vector3, lift: number) => {
    projected.copy(world);
    projected.y += lift;
    projected.project(camera);
    const onScreen = projected.z < 1 && Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.82;
    if (onScreen) {
      options.positionLabel(id, (projected.x * 0.5 + 0.5) * canvas.clientWidth, (-projected.y * 0.5 + 0.5) * canvas.clientHeight, true, null);
      return;
    }
    if (id === "sun") {
      options.positionLabel(id, 0, 0, false, null);
      return;
    }

    // Off-screen: pin it to the edge of the view, pointing towards it.
    let dx = projected.x;
    let dy = projected.y;
    if (projected.z >= 1) {
      // Behind her: the projection is mirrored.
      dx = -dx;
      dy = -dy;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        dy = -1;
      }
    }
    const scale = Math.min(0.6 / Math.max(Math.abs(dx), 1e-4), 0.78 / Math.max(Math.abs(dy), 1e-4));
    const ex = dx * scale;
    const ey = dy * scale;
    options.positionLabel(id, (ex * 0.5 + 0.5) * canvas.clientWidth, (-ey * 0.5 + 0.5) * canvas.clientHeight, true, { angle: Math.atan2(-dy, dx) });
  };

  const animate = () => {
    frameId = window.requestAnimationFrame(animate);
    if (paused || disposed) {
      return;
    }

    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;

    if (!frozen) {
      orbitTime += delta;
    }

    // Look-around inertia.
    if (pointers.size === 0 && !flying) {
      pose.yaw += velYaw;
      pose.pitch += velPitch;
      velYaw *= 0.93;
      velPitch *= 0.93;
      clampPitch();
    }

    for (const body of bodies) {
      bodyPosition(body, body.group.position);
      if (body.spin) {
        body.spin.rotation.y += delta * (body.def.id === "memory-constellation" ? 0.06 : 0.1);
      }
      if (body.def.id === "heart-chamber" && body.pulse) {
        // A slow heartbeat: two soft beats, then rest.
        const beat = Math.pow(Math.max(Math.sin(elapsed * 2.2), 0), 6) + Math.pow(Math.max(Math.sin(elapsed * 2.2 - 0.7), 0), 8) * 0.6;
        body.pulse.material.opacity = 0.4 + beat * 0.35;
      }
      if (body.extra) {
        body.extra.rotation.y += delta * 0.35;
      }
    }

    sunMaterial.uniforms.uTime.value = elapsed;
    sunBody.scale.setScalar(1 + Math.sin(elapsed * 0.9) * 0.012);
    sunHalo.material.opacity = 0.82 + Math.sin(elapsed * 0.7) * 0.08;

    (farStars.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    (midStars.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    farStars.rotation.y += delta * 0.003;
    sky.rotation.y += delta * 0.0015;

    if (!reducedMotion) {
      const attr = dustGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i += 1) {
        let x = attr.getX(i) + Math.sin(elapsed * 0.1 + i) * delta * 0.5;
        let y = attr.getY(i) + delta * 0.35;
        const z = attr.getZ(i);
        if (y > DUST_BOX) y = -DUST_BOX;
        if (x > DUST_BOX) x = -DUST_BOX;
        attr.setXYZ(i, x, y, z);
      }
      attr.needsUpdate = true;

      // Occasional shooting star across the far sky.
      if (streakLife <= 0 && elapsed > nextStreakAt) {
        streakLife = 1;
        nextStreakAt = elapsed + 7 + Math.random() * 9;
        streakDirection.set(Math.random() - 0.5, 0.15 + Math.random() * 0.4, Math.random() - 0.5).normalize();
        streak.position.copy(streakDirection).multiplyScalar(420).add(tmp.set(pose.x, pose.y, pose.z));
        streak.material.rotation = Math.random() * 0.6 - 0.9;
      }
      if (streakLife > 0) {
        streakLife -= delta * 1.6;
        streak.material.opacity = Math.max(Math.sin(Math.max(streakLife, 0) * Math.PI), 0) * 0.9;
        streak.position.x += delta * 160;
        streak.position.y -= delta * 55;
      } else {
        streak.material.opacity = 0;
      }
    }

    if (vr && head) {
      // The phone is the head. No camera bob in VR (it causes motion sickness).
      camera.position.set(pose.x, pose.y, pose.z);
      poseEuler.set(pose.pitch, pose.yaw, 0);
      poseQuat.setFromEuler(poseEuler);
      head.update(headQuat);
      camera.quaternion.copy(poseQuat).multiply(headQuat);

      // Re-centre once she has had time to settle into the viewer.
      if (!vrRecentered && vrSeconds() > GAZE_DELAY - 0.4) {
        head.recenter();
        vrRecentered = true;
      }

      welcome.material.opacity = Math.min(Math.max((GAZE_DELAY - vrSeconds()) / 1.2, 0), 1);
      welcome.sprite.visible = welcome.material.opacity > 0.01;
      vignette += ((flying ? 0.6 : 0) - vignette) * Math.min(delta * 4, 1);

      // The Return / Exit button hangs below her line of sight.
      // Always the same angle below the view centre, wherever the world has her looking.
      const dockPitch = pose.pitch - 0.55;
      const dockDistance = VR_UI_DISTANCE * 1.15;
      dock.position.set(
        pose.x - Math.sin(pose.yaw) * Math.cos(dockPitch) * dockDistance,
        pose.y + Math.sin(dockPitch) * dockDistance,
        pose.z - Math.cos(pose.yaw) * Math.cos(dockPitch) * dockDistance,
      );
      dock.lookAt(camera.position);

      // Names would collide with the Return button while she is visiting a world.
      vrOnlyObjects.forEach((item) => (item.visible = !frozen));
      interior?.update(delta, elapsed);
      place?.update(delta, elapsed);
      updateGaze(delta);
      stereo?.render(activeScene, camera, vignette);
      return;
    }

    // A tiny breathing drift so the viewer always feels suspended in space.
    const bob = reducedMotion || flying || frozen ? 0 : Math.sin(elapsed * 0.45) * 0.35;
    camera.position.set(pose.x, pose.y + bob, pose.z);
    // The arrival sweep: a slow turn left and right (fades out, and stops at once on any touch).
    const sweepWindow = 14;
    const sweep =
      introSweepDone || reducedMotion || flying || frozen || elapsed > sweepWindow
        ? 0
        : 0.7 * Math.sin(elapsed * 0.55) * Math.min(elapsed / 2, 1) * Math.min((sweepWindow - elapsed) / 3, 1);
    camera.rotation.set(pose.pitch + tiltPitch, pose.yaw + tiltYaw + sweep, 0);

    interior?.update(delta, elapsed);
    renderer.render(activeScene, camera);

    // Keep the DOM labels glued to their planets (not while inside a world).
    if (inside) {
      return;
    }
    for (const body of bodies) {
      project(body.def.id, body.group.position, -body.def.radius * 1.25);
    }
    project("sun", sun.position, -SUN_RADIUS * 1.1);
  };

  animate();

  return {
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      stereo?.dispose();
      head?.dispose();
      interior?.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", applyAspect);
      window.removeEventListener("deviceorientation", onTilt);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
    },
    setPaused: (value) => {
      paused = value;
      if (!value) {
        clock.getDelta();
      }
    },
    flyTo,
    flyHome,
    dolly,
    resetView,
    enterVR,
    exitVR,
    setDockMode,
    aim: (id) => {
      if (id === "dock") {
        const toDock = dock.position.clone().sub(new THREE.Vector3(pose.x, pose.y, pose.z)).normalize();
        pose.yaw = Math.atan2(-toDock.x, -toDock.z);
        pose.pitch = Math.asin(toDock.y);
        return;
      }
      const body = bodies.find((item) => item.def.id === id);
      if (!body) {
        return;
      }
      const direction = body.group.position.clone().sub(new THREE.Vector3(pose.x, pose.y, pose.z)).normalize();
      pose.yaw = Math.atan2(-direction.x, -direction.z);
      pose.pitch = Math.asin(direction.y);
    },
    setPlace,
    enterInterior,
    exitInterior,
    getViewpoint: () => ({ position: new THREE.Vector3(pose.x, pose.y, pose.z), yaw: pose.yaw, pitch: pose.pitch }),
  };
}
