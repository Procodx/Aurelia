import * as THREE from "three";

/** A shell of twinkling points at a distance range around the origin. */
export function starShell(count: number, minRadius: number, maxRadius: number, sizeRange: [number, number], pixelRatio: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const palette = ["#fff7d6", "#d9e7ff", "#e5cffd", "#ffdfac", "#ffffff"].map((c) => new THREE.Color(c));
  const direction = new THREE.Vector3();

  for (let i = 0; i < count; i += 1) {
    direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    positions.set([direction.x * radius, direction.y * radius, direction.z * radius], i * 3);
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors.set([color.r, color.g, color.b], i * 3);
    // Mostly tiny stars with a few bright ones.
    sizes[i] = sizeRange[0] + Math.pow(Math.random(), 3.2) * (sizeRange[1] - sizeRange[0]);
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 color;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        vTwinkle = 0.72 + 0.28 * sin(uTime * (0.6 + aSize * 0.35) + aPhase);
        gl_PointSize = aSize * uPixelRatio * vTwinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vColor, a * a * vTwinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}
