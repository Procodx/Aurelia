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
  { id: "heart-chamber", orbitRadius: 34, orbitDuration: 72, phase: 4.1, tilt: 0.22, radius: 6.6 },
  { id: "memory-constellation", orbitRadius: 48, orbitDuration: 80, phase: 0.9, tilt: -0.18, radius: 8.4 },
  { id: "garden-planet", orbitRadius: 58, orbitDuration: 88, phase: 2.8, tilt: 0.3, radius: 8 },
  { id: "echo-moon", orbitRadius: 70, orbitDuration: 104, phase: 5.0, tilt: -0.26, radius: 5.6 },
  { id: "future-stars", orbitRadius: 80, orbitDuration: 120, phase: 1.9, tilt: 0.14, radius: 7 },
];

export const SUN_RADIUS = 9.5;
