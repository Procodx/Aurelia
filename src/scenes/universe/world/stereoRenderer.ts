import * as THREE from "three";

// Google Cardboard (v1) lens coefficients. The lenses stretch the image like a
// magnifying glass (pincushion), so we pre-warp the picture the opposite way
// (barrel) and the two cancel out.
const CARDBOARD_K = new THREE.Vector2(0.441, 0.156);

type StereoOptions = {
  renderer: THREE.WebGLRenderer;
  lowPower: boolean;
};

export type StereoRenderer = {
  resize: () => void;
  render: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, vignette: number) => void;
  setEyeSeparation: (value: number) => void;
  dispose: () => void;
};

export function createStereoRenderer({ renderer, lowPower }: StereoOptions): StereoRenderer {
  const stereo = new THREE.StereoCamera();
  stereo.eyeSep = 1;

  const size = new THREE.Vector2();
  let targetLeft: THREE.WebGLRenderTarget | null = null;
  let targetRight: THREE.WebGLRenderTarget | null = null;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tLeft: { value: null as THREE.Texture | null },
      tRight: { value: null as THREE.Texture | null },
      uK: { value: CARDBOARD_K },
      uVignette: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tLeft;
      uniform sampler2D tRight;
      uniform vec2 uK;
      uniform float uVignette;
      varying vec2 vUv;
      void main() {
        bool left = vUv.x < 0.5;
        float lx = (left ? vUv.x : vUv.x - 0.5) * 4.0 - 1.0;
        vec2 p = vec2(lx, vUv.y * 2.0 - 1.0);
        float r2 = dot(p, p);
        float k = (1.0 + uK.x * r2 + uK.y * r2 * r2) / (1.0 + uK.x + uK.y);
        vec2 src = p * k * 0.5 + 0.5;
        vec3 color = vec3(0.0);
        if (src.x >= 0.0 && src.x <= 1.0 && src.y >= 0.0 && src.y <= 1.0) {
          color = (left ? texture2D(tLeft, src) : texture2D(tRight, src)).rgb;
        }
        // Comfort vignette (used while flying) and a hard edge where the lens ends.
        color *= 1.0 - uVignette * smoothstep(0.3, 1.15, length(p));
        color *= smoothstep(1.0, 0.94, length(p * vec2(0.82, 1.0)));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const releaseTargets = () => {
    targetLeft?.dispose();
    targetRight?.dispose();
    targetLeft = null;
    targetRight = null;
  };

  const resize = () => {
    renderer.getDrawingBufferSize(size);
    const eyeWidth = Math.max(Math.floor(size.x / 2), 2);
    const eyeHeight = Math.max(Math.floor(size.y), 2);
    releaseTargets();
    const options = { type: THREE.HalfFloatType, samples: lowPower ? 0 : 2, depthBuffer: true };
    targetLeft = new THREE.WebGLRenderTarget(eyeWidth, eyeHeight, options);
    targetRight = new THREE.WebGLRenderTarget(eyeWidth, eyeHeight, options);
    material.uniforms.tLeft.value = targetLeft.texture;
    material.uniforms.tRight.value = targetRight.texture;
    stereo.aspect = eyeWidth / eyeHeight;
  };

  resize();

  return {
    resize,
    setEyeSeparation: (value) => {
      stereo.eyeSep = value;
    },
    render: (scene, camera, vignette) => {
      if (!targetLeft || !targetRight) {
        return;
      }

      camera.updateMatrixWorld();
      stereo.update(camera);

      renderer.setRenderTarget(targetLeft);
      renderer.render(scene, stereo.cameraL);
      renderer.setRenderTarget(targetRight);
      renderer.render(scene, stereo.cameraR);

      material.uniforms.uVignette.value = vignette;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCamera);
    },
    dispose: () => {
      releaseTargets();
      quad.geometry.dispose();
      material.dispose();
      renderer.setRenderTarget(null);
    },
  };
}
