import * as THREE from "three";

// Everything here is generated in code (no image files), so the universe
// stays light to download and every planet gets a unique, painterly surface.

function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}

export function fbm3(x: number, y: number, z: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise3(x * freq, y * freq, z * freq) * amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ramp(stops: RGB[], t: number): RGB {
  const scaled = Math.min(Math.max(t, 0), 0.9999) * (stops.length - 1);
  const index = Math.floor(scaled);
  return mix(stops[index], stops[index + 1], scaled - index);
}

function makeTexture(canvas: HTMLCanvasElement, srgb = true) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

type SurfaceStyle = "garden" | "moon" | "heart";

// Equirectangular surface painted by sampling 3D noise on the sphere, so
// there is no visible seam where the texture wraps around.
export function createPlanetTexture(style: SurfaceStyle, width = 384, height = 192) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(width, height);

  const garden = [hexToRgb("#14575a"), hexToRgb("#2b9a86"), hexToRgb("#6fd0a0"), hexToRgb("#c6f0b4")];
  const bloomPink = hexToRgb("#ff9ec4");
  const bloomGold = hexToRgb("#ffd987");
  const moon = [hexToRgb("#59627a"), hexToRgb("#8d96b3"), hexToRgb("#cfd6ea"), hexToRgb("#f2f4ff")];
  const heart = [hexToRgb("#7a2f78"), hexToRgb("#d0587f"), hexToRgb("#ff9c86"), hexToRgb("#ffdcae")];

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    const lat = (v - 0.5) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const lon = u * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon);
      const py = Math.sin(lat);
      const pz = Math.cos(lat) * Math.sin(lon);

      let color: RGB;
      if (style === "garden") {
        const n = fbm3(px * 2.4 + 3, py * 2.4, pz * 2.4, 5);
        color = ramp(garden, n * 1.25 - 0.1);
        const bloom = fbm3(px * 9 + 11, py * 9, pz * 9, 2);
        if (bloom > 0.64) {
          color = mix(color, bloom > 0.72 ? bloomGold : bloomPink, Math.min((bloom - 0.64) * 9, 0.9));
        }
      } else if (style === "moon") {
        const n = fbm3(px * 3.2, py * 3.2, pz * 3.2, 5);
        color = ramp(moon, n * 1.3 - 0.15);
        const crater = fbm3(px * 7 + 5, py * 7, pz * 7, 2);
        if (crater > 0.6) {
          color = mix(color, [60, 66, 88], Math.min((crater - 0.6) * 4.5, 0.55));
        }
      } else {
        const warp = fbm3(px * 1.6, py * 3.4, pz * 1.6, 4);
        const bands = Math.sin((py + warp * 0.9) * 7.5) * 0.5 + 0.5;
        const swirl = fbm3(px * 3.6 + 7, py * 3.6, pz * 3.6, 4);
        color = ramp(heart, bands * 0.62 + swirl * 0.5 - 0.1);
      }

      const i = (y * width + x) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return makeTexture(canvas);
}

// Inside-of-a-sphere backdrop: a tilted Milky Way band plus drifting nebula
// clouds, so there is something to look at in every direction.
export function createSkyTexture(width = 640, height = 320) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(width, height);

  const band = new THREE.Vector3(0.28, 0.9, 0.34).normalize();
  const lavender: RGB = hexToRgb("#7d6bd8");
  const gold: RGB = hexToRgb("#e6b878");
  const blue: RGB = hexToRgb("#3f66c9");
  const rose: RGB = hexToRgb("#c8507f");

  for (let y = 0; y < height; y += 1) {
    const lat = ((y / (height - 1)) - 0.5) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const lon = (x / (width - 1)) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon);
      const py = Math.sin(lat);
      const pz = Math.cos(lat) * Math.sin(lon);

      const across = px * band.x + py * band.y + pz * band.z;
      const core = Math.exp(-(across * across) / 0.028);
      const halo = Math.exp(-(across * across) / 0.16);
      const dust = fbm3(px * 3.2 + 2, py * 3.2, pz * 3.2, 5);
      const lane = fbm3(px * 6 + 9, py * 6, pz * 6, 3);

      let intensity = core * (0.35 + dust * 0.9) * (1 - Math.max(lane - 0.55, 0) * 1.6) + halo * dust * 0.18;
      const cloud = fbm3(px * 2.1 + 20, py * 2.1, pz * 2.1, 4);
      const cloudMask = Math.max(cloud - 0.52, 0) * 2.2;
      intensity += cloudMask * 0.34;

      const warm = fbm3(px * 1.4 + 40, py * 1.4, pz * 1.4, 3);
      let color = mix(mix(blue, lavender, dust), gold, core * warm);
      color = mix(color, rose, Math.min(cloudMask * warm * 1.4, 0.7));

      const i = (y * width + x) * 4;
      const level = Math.min(intensity, 1) * 0.62;
      image.data[i] = color[0] * level + 2;
      image.data[i + 1] = color[1] * level + 3;
      image.data[i + 2] = color[2] * level + 8;
      image.data[i + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return makeTexture(canvas);
}

export function createGlowTexture(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.12)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return makeTexture(canvas, false);
}
