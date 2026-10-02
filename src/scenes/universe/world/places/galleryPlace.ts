import * as THREE from "three";
import type { Viewpoint, VRPlace } from "../vrPlace";
import { ARM_AFTER, SHELF_DROP, createAmbient, createBurst, createKit, type Sheet } from "./placeKit";

export type GalleryItem = {
  id: string;
  /** Paint the card shown on the shelf (canvas is CARD_W x CARD_H). */
  paintCard: (ctx: CanvasRenderingContext2D, width: number, height: number) => Promise<void> | void;
  pageCount: number;
  /** Paint one full page (canvas is PAGE_W x PAGE_H). */
  paintPage: (index: number, ctx: CanvasRenderingContext2D, width: number, height: number) => Promise<void> | void;
};

type GalleryOptions = {
  items: GalleryItem[];
  viewpoint: Viewpoint;
  ambient: { mode: "motes" | "petals"; color: string; count?: number };
  burstColor?: string;
  /** Called when an item is opened (e.g. to mark something as seen). */
  onOpen?: (item: GalleryItem) => void;
  /** Cards float and tilt a little for an organic feel. */
  organic?: boolean;
};

export const CARD_W = 640;
export const CARD_H = 440;
export const PAGE_W = 1280;
export const PAGE_H = 720;

const SHELF_SIZE = 5;
const CARD_RADIUS = 15;
const CARD_WIDTH = 5.2;
const PAGE_DISTANCE = 12.5;
const PAGE_WIDTH = 14.5;

export function createGalleryPlace({ items, viewpoint, ambient: ambientOptions, burstColor, onOpen, organic = false }: GalleryOptions): VRPlace {
  const kit = createKit(viewpoint);
  const { group, origin, around, makeSheet, makeButton } = kit;
  const ambient = createAmbient(kit, ambientOptions);
  const burst = createBurst(kit, burstColor);

  // ---------- Shelf ----------
  type Card = { item: GalleryItem; sheet: Sheet; home: THREE.Vector3; scale: number; phase: number };
  let cards: Card[] = [];
  let shelfPage = 0;
  let shelfFade = 0;
  const shelfGroup = new THREE.Group();
  group.add(shelfGroup);
  const pageCount = Math.max(Math.ceil(items.length / SHELF_SIZE), 1);

  const clearShelf = () => {
    for (const card of cards) {
      shelfGroup.remove(card.sheet.mesh);
      card.sheet.texture.dispose();
      card.sheet.material.dispose();
      card.sheet.mesh.geometry.dispose();
    }
    cards = [];
  };

  const buildShelf = () => {
    clearShelf();
    const visible = items.slice(shelfPage * SHELF_SIZE, shelfPage * SHELF_SIZE + SHELF_SIZE);
    visible.forEach((item, index) => {
      const angle = (index - (visible.length - 1) / 2) * 0.42;
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const sheet = makeSheet(canvas, CARD_WIDTH);
      // Only ever lower items, never raise them into her line of sight.
      const wave = organic ? (Math.sin(index * 1.9) - 1) * 0.45 : 0;
      sheet.mesh.position.copy(around(angle, CARD_RADIUS, -SHELF_DROP + Math.abs(angle) * 1.4 + wave));
      sheet.mesh.lookAt(origin);
      if (organic) {
        sheet.mesh.rotateZ(Math.sin(index * 2.3) * 0.12);
      }
      sheet.mesh.userData = { dwell: 1.3, onSelect: () => openItem(item) };
      shelfGroup.add(sheet.mesh);
      cards.push({ item, sheet, home: sheet.mesh.position.clone(), scale: 1, phase: index * 1.3 });

      // Cards may need to load images first; they appear as soon as they are painted.
      const ctx = canvas.getContext("2d")!;
      void Promise.resolve(item.paintCard(ctx, CARD_W, CARD_H)).then(() => {
        sheet.texture.needsUpdate = true;
      });
    });
  };

  const prevShelf = pageCount > 1 ? makeButton("‹  earlier", 0.78, CARD_RADIUS - 1, -SHELF_DROP, () => changeShelf(-1)) : null;
  const nextShelf = pageCount > 1 ? makeButton("later  ›", -0.78, CARD_RADIUS - 1, -SHELF_DROP, () => changeShelf(1)) : null;
  const changeShelf = (delta: number) => {
    shelfPage = (shelfPage + delta + pageCount) % pageCount;
    buildShelf();
    shelfFade = 0;
  };

  // ---------- Open page ----------
  let openId: string | null = null;
  let openItemRef: GalleryItem | null = null;
  let pageIndex = 0;
  let paintToken = 0;

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = PAGE_W;
  pageCanvas.height = PAGE_H;
  const pageSheet = makeSheet(pageCanvas, PAGE_WIDTH);
  pageSheet.mesh.position.copy(around(0, PAGE_DISTANCE));
  pageSheet.mesh.lookAt(origin);
  pageSheet.mesh.visible = false;
  group.add(pageSheet.mesh);
  const pageHeight = PAGE_WIDTH * (PAGE_H / PAGE_W);

  const closeButton = makeButton("Close", 0, PAGE_DISTANCE - 1, 0, () => closeItem());
  closeButton.mesh.position.setY(pageSheet.mesh.position.y + pageHeight / 2 + 1.6);
  closeButton.mesh.lookAt(origin);
  const nextPage = makeButton("next page  ›", -0.74, PAGE_DISTANCE - 0.5, 0, () => turnPage(1));
  const prevPage = makeButton("‹  back", 0.74, PAGE_DISTANCE - 0.5, 0, () => turnPage(-1));
  const pageButtons = [closeButton, nextPage, prevPage];

  const paintPage = async () => {
    if (!openItemRef) {
      return;
    }
    const token = (paintToken += 1);
    const ctx = pageCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = "rgba(16, 14, 40, 0.92)";
    ctx.beginPath();
    ctx.roundRect(14, 14, PAGE_W - 28, PAGE_H - 28, 44);
    ctx.fill();
    pageSheet.texture.needsUpdate = true;

    await openItemRef.paintPage(pageIndex, ctx, PAGE_W, PAGE_H);
    if (token === paintToken) {
      pageSheet.texture.needsUpdate = true;
    }
  };

  const updateButtons = () => {
    const multi = (openItemRef?.pageCount ?? 1) > 1;
    closeButton.mesh.visible = Boolean(openId);
    nextPage.mesh.visible = Boolean(openId) && multi && pageIndex < (openItemRef?.pageCount ?? 1) - 1;
    prevPage.mesh.visible = Boolean(openId) && multi && pageIndex > 0;
    [prevShelf, nextShelf].forEach((sheet) => sheet && (sheet.mesh.visible = !openId));
  };

  const openItem = (item: GalleryItem) => {
    openId = item.id;
    openItemRef = item;
    pageIndex = 0;
    shelfGroup.visible = false;
    pageSheet.mesh.visible = true;
    pageSheet.material.opacity = 0;
    updateButtons();
    void paintPage();
    onOpen?.(item);
  };

  const closeItem = () => {
    openId = null;
    openItemRef = null;
    paintToken += 1;
    pageSheet.mesh.visible = false;
    shelfGroup.visible = true;
    shelfFade = 0.4;
    updateButtons();
  };

  const turnPage = (delta: number) => {
    if (!openItemRef) {
      return;
    }
    pageIndex = Math.min(Math.max(pageIndex + delta, 0), openItemRef.pageCount - 1);
    updateButtons();
    void paintPage();
  };

  buildShelf();
  updateButtons();

  let age = 0;
  let gazed: THREE.Object3D | null = null;
  const buttonMeshes = [closeButton, nextPage, prevPage, prevShelf, nextShelf].filter(Boolean).map((sheet) => (sheet as Sheet).mesh);

  return {
    group,
    targets: () => {
      if (age < ARM_AFTER) {
        return [];
      }
      if (openId) {
        return pageButtons.map((sheet) => sheet.mesh).filter((mesh) => mesh.visible);
      }
      return [...cards.map((card) => card.sheet.mesh), ...[prevShelf, nextShelf].filter(Boolean).map((sheet) => (sheet as Sheet).mesh)];
    },
    onGaze: (target) => {
      gazed = target;
    },
    update: (delta) => {
      age += delta;
      burst.update(age);
      ambient.update(delta, age);

      shelfFade = Math.min(shelfFade + delta / 1.2, 1);
      cards.forEach((card, index) => {
        const appear = Math.min(Math.max((age - 0.6 - index * 0.18) / 0.9, 0) * shelfFade, 1);
        card.sheet.material.opacity = appear;
        card.scale += ((gazed === card.sheet.mesh ? 1.1 : 1) - card.scale) * Math.min(delta * 8, 1);
        card.sheet.mesh.scale.setScalar(card.scale);
        card.sheet.mesh.position.y = card.home.y + Math.sin(age * 0.8 + card.phase) * 0.14;
      });

      for (const mesh of buttonMeshes) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        const target = mesh.visible ? (gazed === mesh ? 1 : 0.8) : 0;
        material.opacity += (target - material.opacity) * Math.min(delta * 6, 1);
        mesh.scale.setScalar(gazed === mesh ? 1.1 : 1);
      }

      if (openId) {
        pageSheet.material.opacity = Math.min(pageSheet.material.opacity + delta * 2.2, 1);
      }
    },
    dispose: () => {
      clearShelf();
      kit.disposables.forEach((item) => item.dispose());
      group.removeFromParent();
    },
  };
}
