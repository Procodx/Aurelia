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
      .to(planet, { scale: 1.18, opacity: 1, duration: 0.42 }, 0)
      .to(layer, { scale: 1.24, rotate: -1.4, duration: 0.72 }, 0)
      .to(warp, { opacity: 0.88, scale: 1, rotate: 0, duration: 0.42 }, 0.08)
      .to(layer, { scale: 2.25, rotate: 3.8, duration: 0.82 }, 0.48)
      .to(planet, { scale: 2.05, opacity: 0.92, duration: 0.8 }, 0.48)
      .to(warp, { opacity: 1, scale: 4.2, duration: 0.76 }, 0.46)
      .to(warp, { opacity: 0, scale: 5.6, duration: 0.34, ease: "power2.out" }, 1.1);
  });
}
