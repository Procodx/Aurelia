import * as THREE from "three";
import type { Viewpoint } from "../vrPlace";
import { createGlowTexture } from "../proceduralTextures";

// Shared building blocks for VR places: laying things out on a circle around
// the viewer, drawing glass-like sheets to canvases, gaze-selectable buttons
// and soft ambient particles.

/** Things sit a little below her line of sight so none opens by accident on arrival. */
export const SHELF_DROP = 2.4;
/** Nothing can be selected until the place has finished appearing. */
export const ARM_AFTER = 2.8;

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
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

export function makeCanvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Mipmaps keep small, distant text crisp instead of shimmering.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

/** Draw `image` so it fills the box (cropping the overflow). */
export function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Draw `image` so all of it is visible inside the box. Returns the drawn rectangle. */
export function drawContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

export function drawButtonCanvas(label: string, width = 420) {
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

export type Sheet = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
};

export function createKit(viewpoint: Viewpoint) {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  const origin = viewpoint.position.clone();

  /**
   * A point on a sphere around her. `angle` is how far to the left of her line
   * of sight (radians); `dy` lifts it by that many world units at this radius
   * (negative lowers it). Uses true angles, so it stays exactly where intended
   * relative to her view even when she arrives looking steeply up or down.
   */
  const around = (angle: number, radius: number, dy = 0) => {
    const pitch = viewpoint.pitch + Math.atan2(dy, radius);
    const yaw = viewpoint.yaw + angle;
    return new THREE.Vector3(
      origin.x - Math.sin(yaw) * Math.cos(pitch) * radius,
      origin.y + Math.sin(pitch) * radius,
      origin.z - Math.cos(yaw) * Math.cos(pitch) * radius,
    );
  };

  const makeSheet = (canvas: HTMLCanvasElement, width: number): Sheet => {
    const texture = track(makeCanvasTexture(canvas));
    const material = track(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }));
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(width, width * (canvas.height / canvas.width))), material);
    return { mesh, material, texture, canvas };
  };

  /** A small pill-shaped gaze button. Starts hidden. */
  const makeButton = (label: string, angle: number, radius: number, dy: number, onSelect: () => void, dwell = 1.1, width = 2.6): Sheet => {
    const sheet = makeSheet(drawButtonCanvas(label, 300), width);
    sheet.mesh.position.copy(around(angle, radius, dy));
    sheet.mesh.lookAt(origin);
    sheet.mesh.userData = { dwell, onSelect };
    sheet.mesh.visible = false;
    group.add(sheet.mesh);
    return sheet;
  };

  return { group, track, disposables, origin, around, makeSheet, makeButton };
}

export type Kit = ReturnType<typeof createKit>;

export type Ambient = {
  update: (delta: number, age: number) => void;
};

/**
 * Soft particles filling the air: golden motes that drift, or petals that
 * slowly fall (as in the flat Garden).
 */
export function createAmbient(kit: Kit, options: { mode: "motes" | "petals"; color: string; count?: number }): Ambient {
  const { mode, color } = options;
  const count = options.count ?? 140;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const point = kit.around((Math.random() - 0.5) * Math.PI * 2, 6 + Math.random() * 18);
    positions.set([point.x, point.y + (Math.random() - 0.5) * 16, point.z], i * 3);
  }
  const geometry = kit.track(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = kit.track(
    new THREE.PointsMaterial({
      size: mode === "petals" ? 0.7 : 0.5,
      map: kit.track(createGlowTexture(64)),
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const points = new THREE.Points(geometry, material);
  kit.group.add(points);

  const floor = kit.origin.y - 9;
  const ceiling = kit.origin.y + 11;

  return {
    update: (delta, age) => {
      material.opacity = Math.min(age / 2, 1) * (mode === "petals" ? 0.85 : 0.75);
      if (mode === "petals") {
        // Falling and swaying, wrapping back to the top.
        const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < count; i += 1) {
          let y = attr.getY(i) - delta * 0.9;
          const x = attr.getX(i) + Math.sin(age * 0.6 + i) * delta * 0.5;
          if (y < floor) {
            y = ceiling;
          }
          attr.setXYZ(i, x, y, attr.getZ(i));
        }
        attr.needsUpdate = true;
      } else {
        points.rotation.y += delta * 0.02;
      }
    },
  };
}

/** The door-opening flash used when a place appears. */
export function createBurst(kit: Kit, color = "#ffe2b0") {
  const material = kit.track(
    new THREE.SpriteMaterial({ map: kit.track(createGlowTexture()), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(kit.around(0, 21));
  kit.group.add(sprite);
  return {
    update: (age: number) => {
      material.opacity = Math.max(0, Math.sin(Math.min(age / 2.2, 1) * Math.PI)) * 0.9;
      sprite.scale.setScalar(6 + Math.min(age, 2.2) * 26);
    },
  };
}
