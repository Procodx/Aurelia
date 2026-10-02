type TiltPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

// iOS 13+ only delivers deviceorientation after an explicit permission
// request made from a user gesture (Android and desktop need nothing).
// Call this from a tap handler; it is safe to call more than once.
export async function requestTiltPermission(): Promise<boolean> {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
    return false;
  }

  const requestPermission = (DeviceOrientationEvent as TiltPermissionEvent).requestPermission;
  if (typeof requestPermission !== "function") {
    return true;
  }

  try {
    return (await requestPermission.call(DeviceOrientationEvent)) === "granted";
  } catch {
    return false;
  }
}
