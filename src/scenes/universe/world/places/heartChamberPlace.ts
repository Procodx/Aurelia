import * as THREE from "three";
import type { HeartLetter } from "../../../../features/heart/heartLetters";
import type { Viewpoint, VRPlace } from "../vrPlace";
import { createGlowTexture } from "../proceduralTextures";

type Options = {
  letters: HeartLetter[];
  viewpoint: Viewpoint;
  /** Called the first time an unread letter is opened. */
  onRead: (letter: HeartLetter) => void;
};

const SHELF_SIZE = 5;
const CARD_RADIUS = 15;
const CARD_WIDTH = 5.2;
const PAGE_DISTANCE = 12;
const PAGE_WIDTH = 11.5;
const LINES_PER_PAGE = 11;
/** Cards sit a little below her line of sight so none opens by accident on arrival. */
const SHELF_DROP = 2.4;
/** Nothing can be selected until the chamber has finished appearing. */
const ARM_AFTER = 2.8;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

function makeCanvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Mipmaps keep small, distant text crisp instead of shimmering.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

function drawCard(letter: HeartLetter) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 440;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, 640, 440);
  gradient.addColorStop(0, "rgba(34, 22, 62, 0.9)");
  gradient.addColorStop(1, "rgba(14, 16, 44, 0.9)");
  ctx.fillStyle = gradient;
  roundedRect(ctx, 14, 14, 612, 412, 34);
  ctx.fill();

  ctx.lineWidth = letter.isUnread ? 8 : 4;
  ctx.strokeStyle = letter.isUnread ? "rgba(255, 214, 140, 0.98)" : "rgba(255, 224, 170, 0.5)";
  ctx.shadowColor = "rgba(255, 200, 120, 0.9)";
  ctx.shadowBlur = letter.isUnread ? 28 : 8;
  roundedRect(ctx, 14, 14, 612, 412, 34);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
  ctx.font = '600 28px Georgia, "Times New Roman", serif';
  ctx.fillText((letter.isUnread ? "NEW  ·  " : "") + letter.dateLabel.toUpperCase(), 320, 86);

  ctx.fillStyle = "#fff6e4";
  ctx.font = '50px Georgia, "Times New Roman", serif';
  const lines = wrapLines(ctx, letter.title, 520).slice(0, 3);
  const startY = 220 - ((lines.length - 1) * 60) / 2;
  lines.forEach((line, index) => ctx.fillText(line, 320, startY + index * 60));

  ctx.fillStyle = "rgba(255, 160, 170, 0.9)";
  ctx.font = "34px Georgia, serif";
  ctx.fillText("♥", 320, 372);
  return canvas;
}

function drawButton(label: string, width = 420) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 150;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(12, 14, 40, 0.78)";
  ctx.strokeStyle = "rgba(255, 224, 170, 0.75)";
  ctx.lineWidth = 5;
  roundedRect(ctx, 6, 6, width - 12, 138, 69);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff6e4";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 220, 160, 0.8)";
  ctx.shadowBlur = 14;
  ctx.font = '56px Georgia, "Times New Roman", serif';
  ctx.fillText(label, width / 2, 78);
  return canvas;
}

type PageLayout = { lines: string[]; pages: string[][]; /** Cumulative typed-character count at the end of each page. */ ends: number[] };

export function createHeartChamberPlace({ letters, viewpoint, onRead }: Options): VRPlace {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  const origin = viewpoint.position.clone();

  // A point on a sphere around her, `angle` radians to the left of her line of
  // sight; `dy` lifts it (negative lowers) by that many units at this radius.
  // True angles keep it exactly where intended even when she arrives looking
  // steeply up or down.
  const around = (angle: number, radius: number, dy = 0) => {
    const pitch = viewpoint.pitch + Math.atan2(dy, radius);
    // Looking steeply down squeezes horizontal spacing, so widen it to match.
    const yaw = viewpoint.yaw + angle / Math.max(Math.cos(pitch), 0.4);
    return new THREE.Vector3(
      origin.x - Math.sin(yaw) * Math.cos(pitch) * radius,
      origin.y + Math.sin(pitch) * radius,
      origin.z - Math.cos(yaw) * Math.cos(pitch) * radius,
    );
  };

  const makeSheet = (canvas: HTMLCanvasElement, width: number) => {
    const texture = track(makeCanvasTexture(canvas));
    const material = track(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }));
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(width, width * (canvas.height / canvas.width))), material);
    return { mesh, material, texture, canvas };
  };

  // ---------- Golden motes drifting in the air ----------
  const moteCount = 140;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) {
    const point = around((Math.random() - 0.5) * Math.PI * 2, 6 + Math.random() * 18);
    motePositions.set([point.x, point.y + (Math.random() - 0.5) * 14, point.z], i * 3);
  }
  const moteGeometry = track(new THREE.BufferGeometry());
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeometry,
    track(new THREE.PointsMaterial({ size: 0.5, map: createGlowTexture(64), color: "#ffd9a0", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  group.add(motes);

  // ---------- Light burst when the door opens ----------
  const glowTexture = track(createGlowTexture());
  const burstMaterial = track(new THREE.SpriteMaterial({ map: glowTexture, color: "#ffe2b0", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const burst = new THREE.Sprite(burstMaterial);
  burst.position.copy(around(0, CARD_RADIUS + 6));
  group.add(burst);

  // ---------- Shelf of letter cards ----------
  type Card = { letter: HeartLetter; mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; home: THREE.Vector3; baseScale: number; opened: boolean };
  let shelfPage = 0;
  let cards: Card[] = [];
  const shelfGroup = new THREE.Group();
  group.add(shelfGroup);

  const pageCount = Math.max(Math.ceil(letters.length / SHELF_SIZE), 1);
  const arrowTargets: THREE.Mesh[] = [];

  const clearShelf = () => {
    for (const card of cards) {
      shelfGroup.remove(card.mesh);
      card.material.map?.dispose();
      card.material.dispose();
      card.mesh.geometry.dispose();
    }
    cards = [];
  };

  const buildShelf = () => {
    clearShelf();
    const visible = letters.slice(shelfPage * SHELF_SIZE, shelfPage * SHELF_SIZE + SHELF_SIZE);
    visible.forEach((letter, index) => {
      // About 24 degrees between cards, so they never overlap.
      const angle = (index - (visible.length - 1) / 2) * 0.42;
      const sheet = makeSheet(drawCard(letter), CARD_WIDTH);
      sheet.mesh.position.copy(around(angle, CARD_RADIUS, -SHELF_DROP + Math.abs(angle) * 1.4));
      sheet.mesh.lookAt(origin);
      sheet.mesh.userData = { dwell: 1.3, onSelect: () => openLetter(letter) };
      shelfGroup.add(sheet.mesh);
      cards.push({ letter, mesh: sheet.mesh, material: sheet.material, home: sheet.mesh.position.clone(), baseScale: 1, opened: false });
    });
  };

  const arrow = (label: string, angle: number, onSelect: () => void) => {
    const sheet = makeSheet(drawButton(label, 300), 2.6);
    sheet.mesh.position.copy(around(angle, CARD_RADIUS - 1, -SHELF_DROP));
    sheet.mesh.lookAt(origin);
    sheet.mesh.userData = { dwell: 1.1, onSelect };
    sheet.mesh.visible = false;
    group.add(sheet.mesh);
    arrowTargets.push(sheet.mesh);
    return sheet;
  };

  const prevShelf = pageCount > 1 ? arrow("‹  earlier", 0.78, () => changeShelf(-1)) : null;
  const nextShelf = pageCount > 1 ? arrow("later  ›", -0.78, () => changeShelf(1)) : null;

  const changeShelf = (delta: number) => {
    shelfPage = (shelfPage + delta + pageCount) % pageCount;
    buildShelf();
    shelfFade = 0;
  };

  // ---------- The open letter ----------
  let openLetterId: string | null = null;
  let layout: PageLayout | null = null;
  let typedCount = 0;
  let typedAccumulator = 0;
  let pageIndex = 0;
  let lastDrawnCount = -1;
  let lastDrawnPage = -1;

  const pageSheet = makeSheet(
    (() => {
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 900;
      return canvas;
    })(),
    PAGE_WIDTH,
  );
  pageSheet.mesh.position.copy(around(0, PAGE_DISTANCE));
  pageSheet.mesh.lookAt(origin);
  pageSheet.mesh.visible = false;
  group.add(pageSheet.mesh);

  const closeButton = arrow("Close letter", 0, () => closeLetter());
  closeButton.mesh.position.copy(around(0, PAGE_DISTANCE - 1, (PAGE_WIDTH * (900 / 960)) / 2 + 1.6));
  closeButton.mesh.lookAt(origin);
  const nextPage = arrow("next page  ›", -0.62, () => turnPage(1));
  const prevPage = arrow("‹  back", 0.62, () => turnPage(-1));
  for (const sheet of [nextPage, prevPage]) {
    sheet.mesh.position.copy(around(sheet === nextPage ? -0.62 : 0.62, PAGE_DISTANCE - 0.5));
    sheet.mesh.lookAt(origin);
  }

  const measureCtx = document.createElement("canvas").getContext("2d")!;

  const layoutLetter = (letter: HeartLetter): PageLayout => {
    measureCtx.font = '40px Georgia, "Times New Roman", serif';
    const lines = wrapLines(measureCtx, letter.body, 800);
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
      pages.push(lines.slice(i, i + LINES_PER_PAGE));
    }
    const ends: number[] = [];
    pages.reduce((sum, page) => {
      const next = sum + page.join(" ").length + 1;
      ends.push(next);
      return next;
    }, 0);
    return { lines, pages, ends };
  };

  const drawPage = () => {
    const letter = letters.find((entry) => entry.id === openLetterId);
    if (!letter || !layout) {
      return;
    }

    const { canvas } = pageSheet;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, 900);
    gradient.addColorStop(0, "rgba(40, 28, 70, 0.93)");
    gradient.addColorStop(1, "rgba(14, 14, 40, 0.94)");
    ctx.fillStyle = gradient;
    roundedRect(ctx, 14, 14, 932, 872, 40);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 224, 170, 0.6)";
    ctx.lineWidth = 5;
    ctx.shadowColor = "rgba(255, 200, 120, 0.7)";
    ctx.shadowBlur = 16;
    roundedRect(ctx, 14, 14, 932, 872, 40);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = "left";
    let y = 92;
    if (pageIndex === 0) {
      ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
      ctx.font = '600 26px Georgia, serif';
      ctx.fillText(letter.dateLabel.toUpperCase(), 80, y);
      y += 58;
      ctx.fillStyle = "#fff6e4";
      ctx.font = '48px Georgia, "Times New Roman", serif';
      for (const line of wrapLines(ctx, letter.title, 800).slice(0, 2)) {
        ctx.fillText(line, 80, y);
        y += 56;
      }
      y += 16;
    }

    ctx.fillStyle = "rgba(255, 246, 228, 0.96)";
    ctx.font = '40px Georgia, "Times New Roman", serif';
    // Characters typed so far, counted across the whole letter.
    let remaining = typedCount - (pageIndex > 0 ? layout.ends[pageIndex - 1] : 0);
    for (const line of layout.pages[pageIndex]) {
      const shown = line.slice(0, Math.max(remaining, 0));
      remaining -= line.length + 1;
      if (shown) {
        ctx.fillText(shown, 80, y);
      }
      y += 54;
    }

    if (pageIndex === layout.pages.length - 1 && typedCount >= layout.ends[layout.ends.length - 1] - 1) {
      ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
      ctx.font = 'italic 38px Georgia, serif';
      ctx.textAlign = "right";
      ctx.fillText(`— ${letter.signature}`, 880, 836);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 224, 170, 0.6)";
    ctx.font = "24px Georgia, serif";
    ctx.fillText(`${pageIndex + 1} / ${layout.pages.length}`, 480, 872);

    pageSheet.texture.needsUpdate = true;
    lastDrawnCount = typedCount;
    lastDrawnPage = pageIndex;
  };

  const setButtons = () => {
    const multiPage = Boolean(layout && layout.pages.length > 1);
    nextPage.mesh.visible = Boolean(openLetterId) && multiPage && pageIndex < (layout?.pages.length ?? 1) - 1;
    prevPage.mesh.visible = Boolean(openLetterId) && multiPage && pageIndex > 0;
    closeButton.mesh.visible = Boolean(openLetterId);
    const shelfNav = !openLetterId;
    [prevShelf, nextShelf].forEach((sheet) => sheet && (sheet.mesh.visible = shelfNav));
  };

  const openLetter = (letter: HeartLetter) => {
    openLetterId = letter.id;
    layout = layoutLetter(letter);
    typedCount = 0;
    typedAccumulator = 0;
    pageIndex = 0;
    lastDrawnCount = -1;
    shelfGroup.visible = false;
    pageSheet.mesh.visible = true;
    pageSheet.material.opacity = 0;
    setButtons();
    if (letter.isUnread) {
      letter.isUnread = false;
      onRead(letter);
    }
  };

  const closeLetter = () => {
    openLetterId = null;
    layout = null;
    pageSheet.mesh.visible = false;
    shelfGroup.visible = true;
    // Redraw the cards so a freshly-read letter loses its "NEW" glow.
    buildShelf();
    shelfFade = 0.4;
    setButtons();
  };

  const turnPage = (delta: number) => {
    if (!layout) {
      return;
    }
    pageIndex = Math.min(Math.max(pageIndex + delta, 0), layout.pages.length - 1);
    if (delta > 0) {
      // Moving on finishes the page she was on, so going back shows it complete.
      typedCount = Math.max(typedCount, layout.ends[pageIndex - 1]);
    }
    lastDrawnPage = -1;
    setButtons();
  };

  buildShelf();
  setButtons();

  // ---------- Per-frame ----------
  let shelfFade = 0;
  let age = 0;
  let lastTypedAt = performance.now();
  let gazed: THREE.Object3D | null = null;

  return {
    group,
    targets: () => {
      const list: THREE.Object3D[] = [];
      if (age < ARM_AFTER) {
        return list;
      }
      if (openLetterId) {
        list.push(...[closeButton, nextPage, prevPage].map((sheet) => sheet.mesh).filter((mesh) => mesh.visible));
      } else {
        list.push(...cards.map((card) => card.mesh));
        list.push(...arrowTargets.filter((mesh) => mesh.visible && (mesh === prevShelf?.mesh || mesh === nextShelf?.mesh)));
      }
      return list;
    },
    onGaze: (target) => {
      gazed = target;
    },
    update: (delta) => {
      age += delta;
      // Typing uses real elapsed time, so a slow phone doesn't type slowly.
      const now = performance.now();
      const realDelta = Math.min((now - lastTypedAt) / 1000, 0.3);
      lastTypedAt = now;

      // The door opens: a burst of light, then everything fades in.
      burstMaterial.opacity = Math.max(0, Math.sin(Math.min(age / 2.2, 1) * Math.PI)) * 0.9;
      burst.scale.setScalar(6 + Math.min(age, 2.2) * 26);
      (motes.material as THREE.PointsMaterial).opacity = Math.min(age / 2, 1) * 0.75;
      motes.rotation.y += delta * 0.02;

      shelfFade = Math.min(shelfFade + delta / 1.2, 1);
      cards.forEach((card, index) => {
        const appear = Math.min(Math.max((age - 0.6 - index * 0.18) / 0.9, 0) * shelfFade, 1);
        card.material.opacity = appear;
        const isGazed = gazed === card.mesh;
        card.baseScale += ((isGazed ? 1.1 : 1) - card.baseScale) * Math.min(delta * 8, 1);
        card.mesh.scale.setScalar(card.baseScale);
        // A gentle float.
        card.mesh.position.y = card.home.y + Math.sin(age * 0.8 + index * 1.3) * 0.12;
        if (card.letter.isUnread) {
          card.material.opacity = appear * (0.82 + Math.sin(age * 2.4) * 0.18);
        }
      });

      for (const mesh of arrowTargets) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        const target = mesh.visible ? (gazed === mesh ? 1 : 0.8) : 0;
        material.opacity += (target - material.opacity) * Math.min(delta * 6, 1);
        mesh.scale.setScalar(gazed === mesh ? 1.1 : 1);
      }

      if (openLetterId && layout) {
        pageSheet.material.opacity = Math.min(pageSheet.material.opacity + delta * 2.2, 1);
        // Type out only the page she is reading; it continues when she turns the page.
        const pageEnd = layout.ends[pageIndex];
        if (typedCount < pageEnd) {
          typedAccumulator += realDelta * 38; // characters per second
          const add = Math.floor(typedAccumulator);
          if (add > 0) {
            typedAccumulator -= add;
            typedCount = Math.min(typedCount + add, pageEnd);
          }
        }
        if (typedCount !== lastDrawnCount || pageIndex !== lastDrawnPage) {
          drawPage();
        }
      }
    },
    dispose: () => {
      clearShelf();
      disposables.forEach((item) => item.dispose());
      group.removeFromParent();
    },
  };
}
