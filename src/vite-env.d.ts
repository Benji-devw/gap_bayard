/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" : active l'éditeur visuel (?edit) aussi dans le build de production */
  readonly VITE_EDITOR?: string;
}
