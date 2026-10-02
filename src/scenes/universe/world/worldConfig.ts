export type WorldObjectId =
  | "memory-constellation"
  | "garden-planet"
  | "echo-moon"
  | "heart-chamber"
  | "future-stars";

export type WorldObjectDef = {
  id: WorldObjectId;
  /** Orbit radius around the sun, in world units. */
  orbitRadius: number;
  /** Seconds for one full orbit. */
  orbitDuration: number;
  /** Starting angle, radians. */
  phase: number;
  /** Tilt of the orbit plane, radians (gives the system real depth). */
  tilt: number;
  /** Visual radius of the body; also drives the fly-to distance. */
  radius: number;
};

export const worldObjects: WorldObjectDef[] = [
  { id: "heart-chamber", orbitRadius: 54, orbitDuration: 72, phase: 4.0, tilt: 0.45, radius: 8.4 },
  { id: "memory-constellation", orbitRadius: 66, orbitDuration: 80, phase: 5.2, tilt: -0.5, radius: 10.4 },
  { id: "garden-planet", orbitRadius: 78, orbitDuration: 88, phase: 2.4, tilt: 0.62, radius: 10 },
  { id: "echo-moon", orbitRadius: 92, orbitDuration: 104, phase: 0.3, tilt: -0.4, radius: 7.4 },
  { id: "future-stars", orbitRadius: 108, orbitDuration: 120, phase: 3.6, tilt: 0.3, radius: 9 },
];

export const SUN_RADIUS = 9.5;
