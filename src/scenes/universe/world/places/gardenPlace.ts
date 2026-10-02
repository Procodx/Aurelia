import { complimentReflections, fallbackComplimentReflection } from "../../../../features/blooming/bloomingCopy";
import type { Viewpoint, VRPlace } from "../vrPlace";
import { CARD_H, CARD_W, createGalleryPlace, type GalleryItem } from "./galleryPlace";
import { drawContain, loadImage, roundedRect, wrapLines } from "./placeKit";

export type ComplimentImage = { id: string; title: string; fileName: string; source: string };

const BLOOMS = [
  { petal: "#ff9ec4", core: "#ffd987" },
  { petal: "#ffd987", core: "#ff9ec4" },
  { petal: "#b9a1ff", core: "#ffe6a8" },
  { petal: "#8fe3c0", core: "#fff1b0" },
];

function drawFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, petal: string, core: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = petal;
  ctx.shadowBlur = 36;
  const petals = 9;
  for (let i = 0; i < petals; i += 1) {
    ctx.save();
    ctx.rotate((i / petals) * Math.PI * 2);
    const gradient = ctx.createLinearGradient(0, 0, 0, -radius);
    gradient.addColorStop(0, core);
    gradient.addColorStop(1, petal);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.55, radius * 0.24, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = core;
  ctx.shadowColor = core;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function toItem(compliment: ComplimentImage, index: number): GalleryItem {
  const reflection = complimentReflections[compliment.id] ?? fallbackComplimentReflection;
  const bloom = BLOOMS[index % BLOOMS.length];

  return {
    id: compliment.id,
    pageCount: 2,
    paintCard: (ctx) => {
      // The card is just a glowing flower with its caption - no panel behind it.
      drawFlower(ctx, CARD_W / 2, 170, 150, bloom.petal, bloom.core);
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = bloom.core;
      ctx.font = '600 26px Georgia, serif';
      ctx.fillText(reflection.eyebrow.toUpperCase(), CARD_W / 2, CARD_H - 88);
      ctx.fillStyle = "#fff6e4";
      ctx.font = '36px Georgia, "Times New Roman", serif';
      wrapLines(ctx, reflection.title, 560)
        .slice(0, 2)
        .forEach((line, row) => ctx.fillText(line, CARD_W / 2, CARD_H - 46 + row * 40 - (wrapLines(ctx, reflection.title, 560).length > 1 ? 22 : 0)));
      ctx.shadowBlur = 0;
    },
    paintPage: async (pageIndex, ctx, width, height) => {
      ctx.strokeStyle = bloom.petal;
      ctx.lineWidth = 5;
      ctx.shadowColor = bloom.petal;
      ctx.shadowBlur = 24;
      roundedRect(ctx, 14, 14, width - 28, height - 28, 44);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";

      if (pageIndex === 0) {
        // Her message, and what it meant.
        const box = { x: 70, y: 70, w: 560, h: height - 140 };
        ctx.save();
        roundedRect(ctx, box.x, box.y, box.w, box.h, 26);
        ctx.clip();
        ctx.fillStyle = "rgba(8, 10, 30, 0.9)";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        try {
          drawContain(ctx, await loadImage(compliment.source), box.x, box.y, box.w, box.h);
        } catch {
          drawFlower(ctx, box.x + box.w / 2, box.y + box.h / 2, 160, bloom.petal, bloom.core);
        }
        ctx.restore();

        let y = 124;
        ctx.fillStyle = bloom.core;
        ctx.font = '600 28px Georgia, serif';
        ctx.fillText(reflection.eyebrow.toUpperCase(), 690, y);
        y += 70;
        ctx.fillStyle = "#fff6e4";
        ctx.font = '52px Georgia, "Times New Roman", serif';
        for (const line of wrapLines(ctx, reflection.title, 520)) {
          ctx.fillText(line, 690, y);
          y += 62;
        }
        y += 20;
        ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
        ctx.font = 'italic 38px Georgia, serif';
        for (const line of wrapLines(ctx, `“${reflection.quote}”`, 520)) {
          ctx.fillText(line, 690, y);
          y += 50;
        }
      } else {
        ctx.fillStyle = bloom.core;
        ctx.font = '600 28px Georgia, serif';
        ctx.fillText("WHAT IT MEANT", 90, 112);
        ctx.fillStyle = "rgba(255, 246, 228, 0.96)";
        ctx.font = '37px Georgia, "Times New Roman", serif';
        let y = 176;
        for (const line of wrapLines(ctx, reflection.body, width - 190)) {
          if (y > height - 70) {
            break;
          }
          ctx.fillText(line, 90, y);
          y += 50;
        }
      }
    },
  };
}

export async function createGardenPlace(viewpoint: Viewpoint): Promise<VRPlace | null> {
  let compliments: ComplimentImage[] = [];
  try {
    const response = await fetch("/memories/compliments.json");
    if (response.ok) {
      const library = (await response.json()) as { compliments?: ComplimentImage[] };
      compliments = Array.isArray(library.compliments) ? library.compliments : [];
    }
  } catch {
    compliments = [];
  }

  if (compliments.length === 0) {
    return null;
  }

  return createGalleryPlace({
    items: compliments.map(toItem),
    viewpoint,
    ambient: { mode: "petals", color: "#ffb6d2", count: 170 },
    burstColor: "#ffd2e6",
    organic: true,
  });
}
