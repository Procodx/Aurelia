import { gsap } from "gsap";

type PlanetEnterElements = {
  universe: HTMLElement;
  layer: HTMLElement;
  planet: HTMLElement;
  warp: HTMLElement;
};

export function playPlanetEnter({ universe, layer, planet, warp }: PlanetEnterElements) {
  universe.classList.add("is-planet-entering");
  planet.classList.add("is-being-entered");

  return new Promise<void>((resolve) => {
    const timeline = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        universe.classList.remove("is-planet-entering");
        planet.classList.remove("is-being-entered");
        gsap.set([planet, warp], { clearProps: "transform,opacity,willChange" });
        gsap.set(layer, { clearProps: "opacity,willChange" });
        resolve();
      },
    });

    // Only the entering planet and the warp flash get GPU-layer promotion here.
    // `layer` (celestial-layer) holds all five planets, each with a blurred
    // aura and a box-shadow body. Scaling/rotating that whole subtree forced
    // the browser to re-rasterize every planet's glow on every frame of the
    // warp — that was the real source of the entry stutter, not the flash
    // itself. A plain opacity dip on `layer` gives the same "focus pulls
    // away from the sky" feeling for a fraction of the cost, since opacity
    // is compositor-only and never touches filters/shadows underneath it.
    gsap.set([planet, warp], { force3D: true, willChange: "transform, opacity" });
    gsap.set(layer, { willChange: "opacity" });
    gsap.set(warp, { opacity: 0, scale: 0.22, rotate: -8 });

    timeline
      .to(planet, { scale: 1.16, opacity: 1, duration: 0.3 }, 0)
      .to(layer, { opacity: 0.55, duration: 0.42 }, 0)
      .to(warp, { opacity: 0.78, scale: 0.9, rotate: 0, duration: 0.3 }, 0.04)
      .to(planet, { scale: 1.5, opacity: 0.92, duration: 0.5 }, 0.28)
      .to(warp, { opacity: 0.92, scale: 3.2, duration: 0.48 }, 0.28)
      .to(layer, { opacity: 1, duration: 0.5 }, 0.4)
      .to(warp, { opacity: 0, scale: 3.7, duration: 0.24, ease: "power2.out" }, 0.72);
  });
}