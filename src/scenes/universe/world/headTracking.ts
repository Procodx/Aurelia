import * as THREE from "three";

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const EULER = new THREE.Euler();
const Q_FLIP = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const Q_SCREEN = new THREE.Quaternion();

// Phone gyroscope -> a camera orientation, the same maths three.js'
// DeviceOrientationControls used. The phone sits sideways in a Cardboard
// viewer, so the screen angle is compensated for.
function deviceToQuaternion(out: THREE.Quaternion, alpha: number, beta: number, gamma: number, screenAngle: number) {
  const rad = THREE.MathUtils.degToRad;
  EULER.set(rad(beta), rad(alpha), -rad(gamma), "YXZ");
  out.setFromEuler(EULER);
  out.multiply(Q_FLIP);
  out.multiply(Q_SCREEN.setFromAxisAngle(Z_AXIS, -rad(screenAngle)));
  return out;
}

function currentScreenAngle() {
  if (typeof screen !== "undefined" && screen.orientation) {
    return screen.orientation.angle;
  }
  return (window as unknown as { orientation?: number }).orientation ?? 0;
}

export type HeadTracker = {
  /** Smoothed head rotation, with the heading at calibration time removed. */
  update: (out: THREE.Quaternion) => void;
  /** Treat wherever the head is pointing right now as "straight ahead". */
  recenter: () => void;
  hasSignal: () => boolean;
  dispose: () => void;
};

export function createHeadTracker(): HeadTracker {
  const raw = new THREE.Quaternion();
  const smoothed = new THREE.Quaternion();
  const inverseYaw = new THREE.Quaternion();
  const heading = new THREE.Euler();
  let signal = false;
  let needsFirstCenter = true;

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha === null || event.beta === null || event.gamma === null) {
      return;
    }

    deviceToQuaternion(raw, event.alpha, event.beta, event.gamma, currentScreenAngle());
    if (!signal) {
      smoothed.copy(raw);
    }
    signal = true;
    if (needsFirstCenter) {
      recenter();
      needsFirstCenter = false;
    }
  };

  const recenter = () => {
    if (!signal) {
      return;
    }
    heading.setFromQuaternion(smoothed, "YXZ");
    inverseYaw.setFromAxisAngle(Y_AXIS, heading.y).invert();
  };

  window.addEventListener("deviceorientation", onOrientation);

  return {
    update: (out) => {
      if (!signal) {
        out.identity();
        return;
      }
      // Light smoothing takes the jitter out of the gyroscope without adding noticeable lag.
      smoothed.slerp(raw, 0.55);
      out.copy(inverseYaw).multiply(smoothed);
    },
    recenter,
    hasSignal: () => signal,
    dispose: () => window.removeEventListener("deviceorientation", onOrientation),
  };
}
