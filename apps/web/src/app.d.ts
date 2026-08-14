/// <reference types="vite/client" />

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

interface ImportMetaEnv {
  /** Origin of `@strata/server`; empty means same-origin (see lib/api/base). */
  readonly VITE_STRATA_API?: string;
}

export {};
