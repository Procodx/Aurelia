import { countdownText, formatStarDate, isLit, type FutureStar } from "../../../../features/stars/starsData";
import type { Viewpoint, VRPlace } from "../vrPlace";
import { CARD_H, CARD_W, createGalleryPlace, type GalleryItem } from "./galleryPlace";
import { roundedRect, wrapLines } from "./placeKit";

const TONES: Record<FutureStar["tone"], string> = {
  gold: "#e6b878",
  blue: "#7fb2ff",
  rose: "#f08aa8",
  violet: "#b79bff",
};

function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, lit: boolean, size: number) {
  ctx.save();
  ctx.globalAlpha = lit ? 1 : 0.4;
  ctx.fillStyle = lit ? "#fff4c8" : "#9aa4c8";
  ctx.shadowColor = color;
  ctx.shadowBlur = lit ? size : size * 0.3;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function toItem(star: FutureStar): GalleryItem {
  const tone = TONES[star.tone];
  const lit = isLit(star);

  return {
    id: star.id,
    pageCount: 1,
    paintCard: (ctx) => {
      ctx.fillStyle = "rgba(20, 18, 46, 0.92)";
      roundedRect(ctx, 14, 14, CARD_W - 28, CARD_H - 28, 34);
      ctx.fill();
      ctx.strokeStyle = tone;
      ctx.globalAlpha = lit ? 1 : 0.4;
      ctx.lineWidth = 5;
      ctx.shadowColor = tone;
      ctx.shadowBlur = lit ? 20 : 4;
      roundedRect(ctx, 14, 14, CARD_W - 28, CARD_H - 28, 34);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      paintStar(ctx, CARD_W / 2, 150, tone, lit, 150);
      ctx.textAlign = "center";
      ctx.fillStyle = tone;
      ctx.font = "600 26px Georgia, serif";
      ctx.fillText(formatStarDate(star).toUpperCase(), CARD_W / 2, 300);
      ctx.fillStyle = "#fff6e4";
      ctx.font = '40px Georgia, "Times New Roman", serif';
      ctx.fillText(lit ? "A star is lit" : countdownText(star), CARD_W / 2, 360);
    },
    paintPage: (_index, ctx, width, height) => {
      ctx.strokeStyle = tone;
      ctx.lineWidth = 5;
      ctx.shadowColor = tone;
      ctx.shadowBlur = 24;
      roundedRect(ctx, 14, 14, width - 28, height - 28, 44);
      ctx.stroke();
      ctx.shadowBlur = 0;

      paintStar(ctx, 270, height / 2, tone, lit, 330);
      ctx.textAlign = "left";
      let y = 150;
      ctx.fillStyle = tone;
      ctx.font = "600 30px Georgia, serif";
      ctx.fillText(formatStarDate(star).toUpperCase(), 560, y);
      y += 80;
      ctx.fillStyle = "#fff6e4";
      ctx.font = '56px Georgia, "Times New Roman", serif';
      for (const line of wrapLines(ctx, lit ? star.title : "Not yet…", 600)) {
        ctx.fillText(line, 560, y);
        y += 66;
      }
      y += 20;
      ctx.fillStyle = "rgba(255, 246, 228, 0.92)";
      ctx.font = 'italic 38px Georgia, "Times New Roman", serif';
      for (const line of wrapLines(ctx, lit ? star.message : `${star.hint} ${countdownText(star)}.`, 600)) {
        if (y > height - 70) {
          break;
        }
        ctx.fillText(line, 560, y);
        y += 52;
      }
    },
  };
}

export function createStarsPlace(stars: FutureStar[], viewpoint: Viewpoint): VRPlace {
  return createGalleryPlace({
    items: stars.map(toItem),
    viewpoint,
    ambient: { mode: "motes", color: "#e8d8ff" },
    burstColor: "#ffe9b8",
  });
}
