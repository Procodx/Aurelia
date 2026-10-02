import * as THREE from "three";
import type { EchoTrack } from "../../../../features/echo/echoContent";
import type { Viewpoint, VRPlace } from "../vrPlace";
import { ARM_AFTER, SHELF_DROP, createAmbient, createBurst, createKit, wrapLines, type Sheet } from "./placeKit";

type Options = {
  tracks: EchoTrack[];
  viewpoint: Viewpoint;
  /** An audio element unlocked during the tap that entered VR. */
  audio: HTMLAudioElement;
};

const SHELF_SIZE = 5;
const DISC_RADIUS_SHELF = 14;
const BARS = 56;

function pauseBackdrop() {
  window.dispatchEvent(new Event("aurelia:backdrop-pause"));
}
function resumeBackdrop() {
  window.dispatchEvent(new Event("aurelia:backdrop-resume"));
}

function hashHue(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function paintDisc(canvas: HTMLCanvasElement, track: EchoTrack) {
  const size = canvas.width;
  const c = size / 2;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const vinyl = ctx.createRadialGradient(c, c, size * 0.1, c, c, c);
  vinyl.addColorStop(0, "#1b1b2c");
  vinyl.addColorStop(1, "#07070f");
  ctx.fillStyle = vinyl;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1.5;
  for (let r = size * 0.22; r < c - 14; r += 7) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // A soft light streak across the vinyl.
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0.35, "rgba(255,255,255,0)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.12)");
  sheen.addColorStop(0.65, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fill();

  const hue = hashHue(track.title);
  const label = ctx.createRadialGradient(c, c, 4, c, c, size * 0.2);
  label.addColorStop(0, `hsl(${hue}, 80%, 74%)`);
  label.addColorStop(1, `hsl(${(hue + 40) % 360}, 70%, 52%)`);
  ctx.fillStyle = label;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0a0a14";
  ctx.beginPath();
  ctx.arc(c, c, size * 0.022, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 224, 170, 0.55)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.stroke();
}

function paintTitle(canvas: HTMLCanvasElement, track: EchoTrack, large = false) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#fff6e4";
  ctx.font = `${large ? 62 : 46}px Georgia, "Times New Roman", serif`;
  const lines = wrapLines(ctx, track.title, canvas.width - 60).slice(0, 2);
  lines.forEach((line, index) => ctx.fillText(line, canvas.width / 2, (large ? 76 : 58) + index * (large ? 70 : 52)));
  ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
  ctx.font = `${large ? 40 : 32}px Georgia, serif`;
  ctx.fillText(track.artist, canvas.width / 2, (large ? 76 : 58) + lines.length * (large ? 70 : 52) + 6);
  ctx.shadowBlur = 0;
}

// One analyser per audio element (createMediaElementSource may only run once).
const analysers = new WeakMap<HTMLAudioElement, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> } | null>();

function getAnalyser(audio: HTMLAudioElement) {
  if (analysers.has(audio)) {
    return analysers.get(audio)!;
  }
  try {
    const context = new AudioContext();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    analyser.connect(context.destination);
    const entry = { analyser, data: new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer> };
    analysers.set(audio, entry);
    void context.resume();
    return entry;
  } catch {
    analysers.set(audio, null);
    return null;
  }
}

export function createEchoMoonPlace({ tracks, viewpoint, audio }: Options): VRPlace {
  const kit = createKit(viewpoint);
  const { group, origin, around, makeSheet, makeButton, track } = kit;
  const ambient = createAmbient(kit, { mode: "motes", color: "#bfe4ff" });
  const burst = createBurst(kit, "#cfe0ff");

  const analyserEntry = getAnalyser(audio);

  // ---------- State ----------
  let mode: "shelf" | "player" = "shelf";
  let currentIndex = -1;
  let playing = false;
  let shelfPage = 0;
  let age = 0;
  let gazed: THREE.Object3D | null = null;

  // ---------- Shelf of records ----------
  type Record = { index: number; pivot: THREE.Group; disc: Sheet; titleSheet: Sheet; scale: number };
  let records: Record[] = [];
  const shelfGroup = new THREE.Group();
  group.add(shelfGroup);
  const pageCount = Math.max(Math.ceil(tracks.length / SHELF_SIZE), 1);

  const clearShelf = () => {
    for (const record of records) {
      shelfGroup.remove(record.pivot);
      [record.disc, record.titleSheet].forEach((sheet) => {
        sheet.texture.dispose();
        sheet.material.dispose();
        sheet.mesh.geometry.dispose();
      });
    }
    records = [];
  };

  const buildShelf = () => {
    clearShelf();
    const start = shelfPage * SHELF_SIZE;
    const visible = tracks.slice(start, start + SHELF_SIZE);
    visible.forEach((item, slot) => {
      const index = start + slot;
      const angle = (slot - (visible.length - 1) / 2) * 0.5;
      const discCanvas = document.createElement("canvas");
      discCanvas.width = 512;
      discCanvas.height = 512;
      paintDisc(discCanvas, item);
      const disc = makeSheet(discCanvas, 4.6);
      disc.mesh.userData = { dwell: 1.3, onSelect: () => playTrack(index) };

      const titleCanvas = document.createElement("canvas");
      titleCanvas.width = 640;
      titleCanvas.height = 190;
      paintTitle(titleCanvas, item);
      const titleSheet = makeSheet(titleCanvas, 5.6);
      titleSheet.mesh.position.set(0, -3.9, 0);

      const pivot = new THREE.Group();
      pivot.position.copy(around(angle, DISC_RADIUS_SHELF, -SHELF_DROP + Math.abs(angle) * 1.2));
      pivot.lookAt(origin);
      pivot.add(disc.mesh, titleSheet.mesh);
      shelfGroup.add(pivot);
      records.push({ index, pivot, disc, titleSheet, scale: 1 });
    });
  };

  const prevShelf = pageCount > 1 ? makeButton("‹  earlier", 0.9, DISC_RADIUS_SHELF - 1, -SHELF_DROP, () => changeShelf(-1)) : null;
  const nextShelf = pageCount > 1 ? makeButton("later  ›", -0.9, DISC_RADIUS_SHELF - 1, -SHELF_DROP, () => changeShelf(1)) : null;
  const changeShelf = (delta: number) => {
    shelfPage = (shelfPage + delta + pageCount) % pageCount;
    buildShelf();
  };

  // ---------- Player ----------
  const playerGroup = new THREE.Group();
  playerGroup.visible = false;
  group.add(playerGroup);

  const playerCenter = around(0, 13);
  const bigCanvas = document.createElement("canvas");
  bigCanvas.width = 512;
  bigCanvas.height = 512;
  const bigDisc = makeSheet(bigCanvas, 7);
  bigDisc.mesh.userData = { dwell: 0.9, onSelect: () => togglePlay() };
  const discPivot = new THREE.Group();
  discPivot.position.copy(playerCenter);
  discPivot.lookAt(origin);
  discPivot.add(bigDisc.mesh);
  playerGroup.add(discPivot);

  // Ring of bars that dance to the music.
  const barGeometry = track(new THREE.BoxGeometry(0.2, 1, 0.05));
  barGeometry.translate(0, 0.5, 0);
  const barMaterial = track(new THREE.MeshBasicMaterial({ color: "#ffd9a0", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const bars = new THREE.InstancedMesh(barGeometry, barMaterial, BARS);
  bars.frustumCulled = false;
  discPivot.add(bars);
  const barLevels = new Float32Array(BARS);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const posVec = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  const progressMaterial = track(new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  let progressMesh: THREE.Mesh | null = null;
  let progressStep = -1;

  const titleCanvas = document.createElement("canvas");
  titleCanvas.width = 900;
  titleCanvas.height = 230;
  const titleSheet = makeSheet(titleCanvas, 9);
  titleSheet.mesh.position.copy(around(0, 13, -6.9));
  titleSheet.mesh.lookAt(origin);
  playerGroup.add(titleSheet.mesh);

  const allSongs = makeButton("All songs", 0, 12, 0, () => showShelf(), 1.1, 3);
  allSongs.mesh.position.copy(around(0, 12, 6.2));
  allSongs.mesh.lookAt(origin);
  const prevTrack = makeButton("‹  previous", 0.62, 12.5, 0, () => playTrack((currentIndex - 1 + tracks.length) % tracks.length));
  const nextTrack = makeButton("next  ›", -0.62, 12.5, 0, () => playTrack((currentIndex + 1) % tracks.length));
  const playerButtons = [allSongs, prevTrack, nextTrack];

  const updateMode = () => {
    const inPlayer = mode === "player";
    shelfGroup.visible = !inPlayer;
    playerGroup.visible = inPlayer;
    playerButtons.forEach((sheet) => (sheet.mesh.visible = inPlayer));
    [prevShelf, nextShelf].forEach((sheet) => sheet && (sheet.mesh.visible = !inPlayer));
  };

  const showShelf = () => {
    mode = "shelf";
    updateMode();
  };

  const playTrack = (index: number) => {
    const item = tracks[index];
    if (!item) {
      return;
    }
    currentIndex = index;
    audio.src = item.source;
    audio.currentTime = 0;
    pauseBackdrop();
    void audio.play().then(() => (playing = true)).catch(() => (playing = false));
    playing = true;
    paintDisc(bigCanvas, item);
    bigDisc.texture.needsUpdate = true;
    paintTitle(titleCanvas, item, true);
    titleSheet.texture.needsUpdate = true;
    mode = "player";
    updateMode();
  };

  const togglePlay = () => {
    if (audio.paused) {
      pauseBackdrop();
      void audio.play().catch(() => undefined);
      playing = true;
    } else {
      audio.pause();
      playing = false;
    }
  };

  const onEnded = () => playTrack((currentIndex + 1) % tracks.length);
  audio.addEventListener("ended", onEnded);

  buildShelf();
  updateMode();

  const buttonSheets = [prevShelf, nextShelf, ...playerButtons].filter(Boolean) as Sheet[];

  return {
    group,
    targets: () => {
      if (age < ARM_AFTER) {
        return [];
      }
      if (mode === "player") {
        return [bigDisc.mesh, ...playerButtons.map((sheet) => sheet.mesh)];
      }
      return [...records.map((record) => record.disc.mesh), ...[prevShelf, nextShelf].filter(Boolean).map((sheet) => (sheet as Sheet).mesh)];
    },
    onGaze: (target) => {
      gazed = target;
    },
    update: (delta) => {
      age += delta;
      burst.update(age);
      ambient.update(delta, age);

      // Records on the shelf turn slowly, the playing one faster.
      records.forEach((record, slot) => {
        const appear = Math.min(Math.max((age - 0.6 - slot * 0.18) / 0.9, 0), 1);
        record.disc.material.opacity = appear;
        record.titleSheet.material.opacity = appear;
        record.disc.mesh.rotation.z += delta * (record.index === currentIndex && playing ? 1.4 : 0.25);
        record.scale += ((gazed === record.disc.mesh ? 1.12 : 1) - record.scale) * Math.min(delta * 8, 1);
        record.pivot.scale.setScalar(record.scale);
      });

      if (mode === "player") {
        bigDisc.material.opacity = Math.min(bigDisc.material.opacity + delta * 2.5, 1);
        titleSheet.material.opacity = Math.min(titleSheet.material.opacity + delta * 2.5, 1);
        if (playing && !audio.paused) {
          bigDisc.mesh.rotation.z -= delta * 1.2;
        }
        bigDisc.mesh.scale.setScalar(bigDisc.mesh.scale.x + ((gazed === bigDisc.mesh ? 1.06 : 1) - bigDisc.mesh.scale.x) * Math.min(delta * 8, 1));

        // Bars: from the real audio if we can read it, otherwise a gentle synthetic sway.
        const live = playing && !audio.paused;
        if (analyserEntry && live) {
          analyserEntry.analyser.getByteFrequencyData(analyserEntry.data);
        }
        for (let i = 0; i < BARS; i += 1) {
          const mirrored = i < BARS / 2 ? i : BARS - 1 - i;
          const bin = Math.min(Math.floor((mirrored / (BARS / 2)) * 36), analyserEntry ? analyserEntry.data.length - 1 : 0);
          const heard = analyserEntry && live ? analyserEntry.data[bin] / 255 : live ? 0.35 + 0.3 * Math.sin(age * 4 + i * 0.6) : 0;
          barLevels[i] += (heard - barLevels[i]) * Math.min(delta * 12, 1);
          const angle = (i / BARS) * Math.PI * 2;
          const radius = 3.8;
          posVec.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
          quat.setFromAxisAngle(zAxis, angle - Math.PI / 2);
          scaleVec.set(1, 0.2 + barLevels[i] * 2.6, 1);
          matrix.compose(posVec, quat, scaleVec);
          bars.setMatrixAt(i, matrix);
        }
        bars.instanceMatrix.needsUpdate = true;

        // Progress ring.
        const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
        const step = Math.round(progress * 120);
        if (step !== progressStep) {
          progressStep = step;
          if (progressMesh) {
            discPivot.remove(progressMesh);
            progressMesh.geometry.dispose();
            progressMesh = null;
          }
          if (step > 0) {
            progressMesh = new THREE.Mesh(new THREE.RingGeometry(3.35, 3.5, 96, 1, Math.PI / 2, -(step / 120) * Math.PI * 2), progressMaterial);
            discPivot.add(progressMesh);
          }
        }
      }

      for (const sheet of buttonSheets) {
        const material = sheet.material;
        const target = sheet.mesh.visible ? (gazed === sheet.mesh ? 1 : 0.8) : 0;
        material.opacity += (target - material.opacity) * Math.min(delta * 6, 1);
        sheet.mesh.scale.setScalar(gazed === sheet.mesh ? 1.1 : 1);
      }
    },
    dispose: () => {
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      resumeBackdrop();
      clearShelf();
      progressMesh?.geometry.dispose();
      kit.disposables.forEach((item) => item.dispose());
      group.removeFromParent();
    },
  };
}

export async function loadEchoTracks(): Promise<EchoTrack[]> {
  try {
    const response = await fetch("/audio/library.json");
    if (!response.ok) {
      return [];
    }
    const library = (await response.json()) as { tracks?: EchoTrack[] };
    return Array.isArray(library.tracks) ? library.tracks : [];
  } catch {
    return [];
  }
}

