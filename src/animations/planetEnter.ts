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
        gsap.set([layer, planet, warp], { clearProps: "transform,opacity,willChange" });
        resolve();
      },
    });

    gsap.set([layer, planet, warp], { force3D: true, willChange: "transform, opacity" });
    gsap.set(warp, { opacity: 0, scale: 0.22, rotate: -8 });

    timeline
      .to(planet, { scale: 1.12, opacity: 1, duration: 0.28 }, 0)
      .to(layer, { scale: 1.12, rotate: -0.7, duration: 0.42 }, 0)
      .to(warp, { opacity: 0.78, scale: 0.9, rotate: 0, duration: 0.3 }, 0.04)
      .to(layer, { scale: 1.68, rotate: 1.8, duration: 0.54 }, 0.28)
      .to(planet, { scale: 1.54, opacity: 0.92, duration: 0.52 }, 0.28)
      .to(warp, { opacity: 0.92, scale: 3.2, duration: 0.48 }, 0.28)
      .to(warp, { opacity: 0, scale: 3.7, duration: 0.24, ease: "power2.out" }, 0.72);
  });
}
