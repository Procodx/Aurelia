import type { WorldObjectId } from "../worldConfig";
import type { Interior, InteriorContext } from "./interiorKit";

export type { Interior, InteriorContext } from "./interiorKit";

/** Builds the inside of a world. Each world's code is loaded only when it is first entered. */
export async function createInterior(id: WorldObjectId, context: InteriorContext): Promise<Interior> {
  switch (id) {
    case "heart-chamber":
      return (await import("./heartInterior")).createHeartInterior(context);
    case "garden-planet":
      return (await import("./gardenInterior")).createGardenInterior(context);
    case "echo-moon":
      return (await import("./echoInterior")).createEchoInterior(context);
    case "future-stars":
      return (await import("./starsInterior")).createStarsInterior(context, true);
    default:
      return (await import("./starsInterior")).createStarsInterior(context, false);
  }
}
