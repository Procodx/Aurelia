import type * as THREE from "three";

// A "place" is the VR version of one of the flat panels: a group of 3D objects
// she can look at to interact with. The world owns gaze-picking; a place just
// says what is selectable and what happens when it is.
//
// Any mesh returned from `targets()` may carry in userData:
//   onSelect: () => void   - called when the gaze dwell completes
//   dwell:    number       - seconds of looking required (default 1.3)
export type VRPlace = {
  group: THREE.Object3D;
  targets: () => THREE.Object3D[];
  update: (delta: number, elapsed: number) => void;
  /** The currently gazed target (or null), so it can light up. */
  onGaze?: (target: THREE.Object3D | null) => void;
  dispose: () => void;
};

export type Viewpoint = {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
};
