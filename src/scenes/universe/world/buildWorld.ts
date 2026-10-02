import * as THREE from "three";
import { gsap } from "gsap";
import { createGlowTexture, createPlanetTexture, createSkyTexture } from "./proceduralTextures";
import { SUN_RADIUS, type WorldObjectDef, type WorldObjectId } from "./worldConfig";

export type WorldOptions = {
  canvas: HTMLCanvasElement;
  objects: WorldObjectDef[];
  reducedMotion: boolean;
  lowPower: boolean;
  onPick: (id: WorldObjectId) => void;
  onHover: (id: WorldObjectId | null) => void;
  /** Called every frame so DOM labels can follow their planets. */
  positionLabel: (id: WorldObjectId | "sun", x: number, y: number, visible: boolean) => void;
};

export type WorldController = {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  flyTo: (id: WorldObjectId) => Promise<void>;
  flyHome: () => Promise<void>;
  dolly: (amount: number) => void;
  resetView: () => void;
};

const MIN_DISTANCE = 22;
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

function starShell(count: number, minRadius: number, maxRadius: number, sizeRange: [number, number], pixelRatio: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const palette = ["#fff7d6", "#d9e7ff", "#e5cffd", "#ffdfac", "#ffffff"].map((c) => new THREE.Color(c));
  const direction = new THREE.Vector3();

  for (let i = 0; i < count; i += 1) {
    direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    positions.set([direction.x * radius, direction.y * radius, direction.z * radius], i * 3);
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors.set([color.r, color.g, color.b], i * 3);
    // Mostly tiny stars with a few bright ones.
    sizes[i] = sizeRange[0] + Math.pow(Math.random(), 3.2) * (sizeRange[1] - sizeRange[0]);
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 color;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        vTwinkle = 0.72 + 0.28 * sin(uTime * (0.6 + aSize * 0.35) + aPhase);
        gl_PointSize = aSize * uPixelRatio * vTwinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vColor, a * a * vTwinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
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
    bodies.push({ def, ...built, pick });
  }

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

  // ---------- Camera rig ----------
  const pose = { x: 0, y: 38, z: 98, yaw: 0, pitch: -0.37 };
  const homePose = { ...pose };
  let tiltYaw = 0;
  let tiltPitch = 0;
  let velYaw = 0;
  let velPitch = 0;
  let orbitTime = 0;
  let frozen = false;
  let paused = false;
  let flying = false;
  let disposed = false;

  const applyAspect = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    const portrait = camera.aspect < 0.85;
    camera.fov = portrait ? 74 : 60;
    camera.updateProjectionMatrix();

    homePose.z = portrait ? 128 : 98;
    homePose.y = portrait ? 46 : 38;
    homePose.pitch = -Math.atan2(homePose.y, homePose.z);
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
    if (flying || frozen) {
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

    await tweenPose({ x: end.x, y: end.y, z: end.z, yaw: endYaw, pitch: endPitch }, 2.6);
    flying = false;
  };

  const flyHome = async () => {
    if (flying) {
      return;
    }

    flying = true;
    await tweenPose({ ...homePose }, 2.2);
    flying = false;
    frozen = false;
  };

  const resetView = () => {
    if (flying || frozen) {
      return;
    }

    flying = true;
    void tweenPose({ ...homePose }, 1.4).then(() => {
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
    if (flying || frozen) {
      return;
    }
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
      if (event.pointerType === "mouse" && !flying && !frozen) {
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
    if (wasTracked && pointers.size === 0 && dragMoved < 8 && performance.now() - downAt < 600) {
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
    dolly(-event.deltaY * 0.05);
  };

  const onTilt = (event: DeviceOrientationEvent) => {
    if (event.gamma === null || event.beta === null || reducedMotion) {
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
    const visible = projected.z < 1 && Math.abs(projected.x) < 1.25 && Math.abs(projected.y) < 1.25;
    options.positionLabel(id, (projected.x * 0.5 + 0.5) * canvas.clientWidth, (-projected.y * 0.5 + 0.5) * canvas.clientHeight, visible);
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

    // A tiny breathing drift so the viewer always feels suspended in space.
    const bob = reducedMotion || flying || frozen ? 0 : Math.sin(elapsed * 0.45) * 0.35;
    camera.position.set(pose.x, pose.y + bob, pose.z);
    camera.rotation.set(pose.pitch + tiltPitch, pose.yaw + tiltYaw, 0);

    renderer.render(scene, camera);

    // Keep the DOM labels glued to their planets.
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
  };
}
