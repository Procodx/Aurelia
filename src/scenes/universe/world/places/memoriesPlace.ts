import type { MemoryMoment } from "../../../../features/memories/memoryData";
import type { Viewpoint, VRPlace } from "../vrPlace";
import { CARD_H, CARD_W, createGalleryPlace, type GalleryItem } from "./galleryPlace";
import { drawContain, drawCover, loadImage, roundedRect, wrapLines } from "./placeKit";

const TONES: Record<MemoryMoment["tone"], string> = {
  gold: "#e6b878",
  blue: "#7fb2ff",
  rose: "#f08aa8",
  violet: "#b79bff",
};

function drawConstellation(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const points = [
    [0.15, 0.7], [0.3, 0.35], [0.5, 0.55], [0.68, 0.25], [0.85, 0.6],
  ].map(([px, py]) => [x + px * w, y + py * h]);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach(([px, py], index) => (index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff4c8";
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  for (const [px, py] of points) {
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function toItem(moment: MemoryMoment): GalleryItem {
  const tone = TONES[moment.tone];

  return {
    id: moment.id,
    pageCount: 1,
    paintCard: async (ctx) => {
      ctx.fillStyle = "rgba(20, 18, 46, 0.92)";
      roundedRect(ctx, 14, 14, CARD_W - 28, CARD_H - 28, 34);
      ctx.fill();

      // Photo window
      ctx.save();
      roundedRect(ctx, 38, 38, CARD_W - 76, 240, 22);
      ctx.clip();
      ctx.fillStyle = "rgba(8, 10, 30, 0.9)";
      ctx.fillRect(38, 38, CARD_W - 76, 240);
      if (moment.imageUrl) {
        try {
          drawCover(ctx, await loadImage(moment.imageUrl), 38, 38, CARD_W - 76, 240);
        } catch {
          drawConstellation(ctx, 38, 38, CARD_W - 76, 240, tone);
        }
      } else {
        drawConstellation(ctx, 38, 38, CARD_W - 76, 240, tone);
      }
      ctx.restore();

      ctx.strokeStyle = tone;
      ctx.lineWidth = 5;
      ctx.shadowColor = tone;
      ctx.shadowBlur = 20;
      roundedRect(ctx, 14, 14, CARD_W - 28, CARD_H - 28, 34);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = "center";
      ctx.fillStyle = tone;
      ctx.font = '600 24px Georgia, serif';
      ctx.fillText(moment.eyebrow.toUpperCase(), CARD_W / 2, 322);
      ctx.fillStyle = "#fff6e4";
      ctx.font = '40px Georgia, "Times New Roman", serif';
      wrapLines(ctx, moment.title, 540)
        .slice(0, 2)
        .forEach((line, index) => ctx.fillText(line, CARD_W / 2, 372 + index * 44));
    },
    paintPage: async (_index, ctx, width, height) => {
      ctx.strokeStyle = tone;
      ctx.lineWidth = 5;
      ctx.shadowColor = tone;
      ctx.shadowBlur = 24;
      roundedRect(ctx, 14, 14, width - 28, height - 28, 44);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Photo on the left
      const box = { x: 70, y: 70, w: 560, h: height - 140 };
      ctx.save();
      roundedRect(ctx, box.x, box.y, box.w, box.h, 26);
      ctx.clip();
      ctx.fillStyle = "rgba(8, 10, 30, 0.9)";
      ctx.fillRect(box.x, box.y, box.w, box.h);
      if (moment.imageUrl) {
        try {
          drawContain(ctx, await loadImage(moment.imageUrl), box.x, box.y, box.w, box.h);
        } catch {
          drawConstellation(ctx, box.x, box.y, box.w, box.h, tone);
        }
      } else {
        drawConstellation(ctx, box.x, box.y, box.w, box.h, tone);
      }
      ctx.restore();

      // Words on the right
      ctx.textAlign = "left";
      let y = 124;
      ctx.fillStyle = tone;
      ctx.font = '600 28px Georgia, serif';
      ctx.fillText(moment.eyebrow.toUpperCase(), 690, y);
      y += 70;
      ctx.fillStyle = "#fff6e4";
      ctx.font = '52px Georgia, "Times New Roman", serif';
      for (const line of wrapLines(ctx, moment.title, 520)) {
        ctx.fillText(line, 690, y);
        y += 62;
      }
      y += 14;
      ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
      ctx.font = 'italic 36px Georgia, serif';
      for (const line of wrapLines(ctx, `“${moment.pullQuote}”`, 520)) {
        ctx.fillText(line, 690, y);
        y += 48;
      }
      y += 18;
      ctx.fillStyle = "rgba(255, 246, 228, 0.92)";
      ctx.font = '33px Georgia, "Times New Roman", serif';
      for (const line of wrapLines(ctx, moment.body, 520)) {
        if (y > height - 80) {
          break;
        }
        ctx.fillText(line, 690, y);
        y += 44;
      }
    },
  };
}

export function createMemoriesPlace(moments: MemoryMoment[], viewpoint: Viewpoint): VRPlace {
  return createGalleryPlace({
    items: moments.map(toItem),
    viewpoint,
    ambient: { mode: "motes", color: "#cfe4ff" },
    burstColor: "#bcd8ff",
  });
}
