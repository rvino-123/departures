/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only: National Rail key used when none is saved. */
  readonly VITE_DEV_NR_API_KEY?: string;
  /** Dev-only: home station code (e.g. MAI) used when none is saved. */
  readonly VITE_DEV_HOME_CRS?: string;
}
