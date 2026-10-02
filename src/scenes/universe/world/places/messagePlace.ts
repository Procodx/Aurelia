import type { Viewpoint, VRPlace } from "../vrPlace";
import { createKit, roundedRect, wrapLines } from "./placeKit";

const W = 1100;
const H = 600;

// A single glowing note hanging in front of her: what a shooting star leaves.
export function createMessagePlace(message: string, viewpoint: Viewpoint): VRPlace {
  const kit = createKit(viewpoint);
  const { group, makeSheet, around, origin } = kit;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(20, 18, 46, 0.92)";
  roundedRect(ctx, 14, 14, W - 28, H - 28, 44);
  ctx.fill();
  ctx.strokeStyle = "#ffd98a";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#ffd98a";
  ctx.shadowBlur = 24;
  roundedRect(ctx, 14, 14, W - 28, H - 28, 44);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd98a";
  ctx.font = "600 28px Georgia, serif";
  ctx.fillText("A SHOOTING STAR LEFT THIS FOR YOU", W / 2, 96);
  ctx.fillStyle = "#fff6e4";
  ctx.font = 'italic 50px Georgia, "Times New Roman", serif';
  const lines = wrapLines(ctx, message, W - 220).slice(0, 5);
  const top = H / 2 - ((lines.length - 1) * 66) / 2 + 12;
  lines.forEach((line, index) => ctx.fillText(line, W / 2, top + index * 66));
  ctx.fillStyle = "rgba(255, 214, 140, 0.9)";
  ctx.font = "34px Georgia, serif";
  ctx.fillText("- Sir Henry", W / 2, H - 70);

  const sheet = makeSheet(canvas, 13);
  sheet.mesh.position.copy(around(0, 12.5, 0.6));
  sheet.mesh.lookAt(origin);
  group.add(sheet.mesh);

  let age = 0;
  return {
    group,
    targets: () => [],
    update: (delta) => {
      age += delta;
      sheet.material.opacity = Math.min(age / 1.2, 1);
      sheet.mesh.position.y += Math.sin(age * 0.8) * delta * 0.05;
    },
    dispose: () => {
      group.removeFromParent();
      kit.disposables.forEach((item) => item.dispose());
    },
  };
}

