/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEART_CHAMBER_SPLINE_SCENE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
