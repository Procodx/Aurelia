import * as THREE from "three";

// Text drawn to a canvas so it can float in 3D (DOM text can't be shown to
// two eyes at once).
export function createTextTexture(text: string, options: { fontSize?: number; color?: string; width?: number; pill?: boolean } = {}) {
  const { fontSize = 64, color = "#fff6e4", width = 768, pill = false } = options;
  const height = Math.round(fontSize * 2.1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;

  if (pill) {
    context.fillStyle = "rgba(10, 14, 36, 0.62)";
    context.strokeStyle = "rgba(255, 224, 160, 0.7)";
    context.lineWidth = 4;
    const radius = height / 2 - 4;
    context.beginPath();
    context.roundRect(4, 4, width - 8, height - 8, radius);
    context.fill();
    context.stroke();
  }

  context.font = `${fontSize}px Georgia, "Times New Roman", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(255, 220, 160, 0.85)";
  context.shadowBlur = 18;
  context.fillStyle = color;
  context.fillText(text, width / 2, height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return { texture, aspect: width / height };
}

export function createTextSprite(text: string, worldWidth: number, options: Parameters<typeof createTextTexture>[1] = {}) {
  const { texture, aspect } = createTextTexture(text, options);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(worldWidth, worldWidth / aspect, 1);
  return { sprite, material, texture };
}
