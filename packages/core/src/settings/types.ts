import type { Logger } from '@strata/sdk';

/** What the workbench paints in; `system` defers to the OS preference. */
export type ThemeMode = 'dark' | 'light' | 'system';

/** How much room the shell gives a row of data. */
export type Density = 'dense' | 'balanced' | 'airy';

/** The order the *Appearance* screen renders them in. */
export const THEME_MODES = [
  'dark',
  'light',
  'system',
] as const satisfies readonly ThemeMode[];

export const DENSITIES = [
  'dense',
  'balanced',
  'airy',
] as const satisfies readonly Density[];

/** *Settings → Appearance*. Read by the shell, not by an analysis. */
export interface AppearanceSettings {
  theme: ThemeMode;
  density: Density;
}

/** *Settings → Plugins & engine*. The only section a run reads. */
export interface EngineSettings {
  /**
   * Directory drop-in plugins are read from, or `null` to follow the
   * environment (`STRATA_PLUGINS_DIR`, else `<cwd>/.strata/plugins`). Stored
   * absolute, and read when the server starts — which is when plugins load.
   */
  pluginsDir: string | null;
  /**
   * Load drop-in plugins at all. Off is the way back into a workbench that a
   * third-party plugin has made unusable, without deleting the directory.
   */
  thirdPartyPlugins: boolean;
  /** Incremental cache on/off. *Clear cache* is `DELETE /cache`, not a setting. */
  cache: boolean;
}

/**
 * *Settings → CI gates* — the thresholds headless CI mode fails a build on.
 * Both default to off: turning a build red is a decision, the same way an
 * architecture rule reports until it is marked enforced.
 */
export interface GateSettings {
  /** Fail when the run finds an import cycle the baseline did not have. */
  failOnNewCycles: boolean;
  /**
   * Percent a hotspot score may grow before the gate fails; `null` for no
   * gate. A percentage rather than an absolute score, because scores are only
   * comparable within one repository.
   */
  hotspotRegression: number | null;
}

/**
 * One configured AI provider: a local coding-agent CLI Strata launches as a
 * subprocess, or a custom one somebody added. This is the *declaration* only —
 * resolving the binary, checking its health and talking to it are the provider
 * work still on the backlog.
 */
export interface AIProviderInstance {
  /** Stable slug; what a provider card and any future `/ai/:id` address. */
  id: string;
  /** What the card is labelled. */
  name: string;
  /** A new provider is off until somebody turns it on. */
  enabled: boolean;
  /** Hex colour the card is tinted with, or `null` for the default accent. */
  accent: string | null;
  /** Path to the agent's binary; `null` to look it up on `PATH`. */
  binary: string | null;
  /** The agent's own home directory, if it keeps one. */
  home: string | null;
  /**
   * Account-specific home that keeps `auth.json` separate while sharing the
   * rest of the agent's state — how one machine runs two accounts.
   */
  shadowHome: string | null;
  /** Extra arguments to launch the binary with, in order. */
  args: string[];
  /**
   * Environment the subprocess gets. Plain values: secret storage is a
   * separate step, so nothing sensitive belongs here yet — what is stored here
   * is served back by `GET /settings` as written.
   */
  env: Record<string, string>;
  /** Model ids this provider offers. */
  models: string[];
}

/** *Settings → AI providers*. */
export interface AISettings {
  /** Minutes between provider health checks; `0` checks only on request. */
  healthCheckInterval: number;
  providers: AIProviderInstance[];
}

/**
 * Everything the app-wide *Settings* screens configure: how the workbench
 * looks, what its engine loads and caches, what its CI gates fail on, and
 * which AI providers it knows about.
 *
 * App-scoped on purpose — none of it belongs to one repository. What an
 * analysis of a *project* does is `ProjectConfig`, one scope down.
 *
 * Stored sparsely — only what somebody set — and merged with the defaults on
 * read, so a default that moves in a later release reaches every workbench
 * that never overrode it.
 */
export interface AppSettings {
  appearance: AppearanceSettings;
  engine: EngineSettings;
  gates: GateSettings;
  ai: AISettings;
}

/** Only the sections and fields somebody set. */
export type StoredAppSettings = {
  [K in keyof AppSettings]?: Partial<AppSettings[K]>;
};

/**
 * What a settings screen sends for one provider. Id and name are required —
 * everything else falls back to the provider defaults, so *Add custom
 * provider* can post a card that is nothing but a name.
 */
export interface AIProviderInput
  extends Partial<Omit<AIProviderInstance, 'id' | 'name'>> {
  id: string;
  name: string;
}

export interface AISettingsPatch {
  healthCheckInterval?: number;
  /** The new list, whole — not an addition to the stored one. */
  providers?: AIProviderInput[];
}

/**
 * A partial update, two levels deep: a section left out keeps everything it
 * had, a field left out inside a named section keeps its value, and an array
 * that is sent replaces the stored one whole. So a screen can send back just
 * the row it changed, and an editor rendering a whole list can send back
 * exactly what it shows.
 */
export interface AppSettingsPatch {
  appearance?: Partial<AppearanceSettings>;
  engine?: Partial<EngineSettings>;
  gates?: Partial<GateSettings>;
  ai?: AISettingsPatch;
}

export interface SettingsStoreOptions {
  /** Database file. Overrides `dir`. */
  path?: string;
  /**
   * Directory to hold `settings.db`. Defaults to `$STRATA_DATA_DIR`, else
   * `<cwd>/.strata`.
   */
  dir?: string;
  /** Where to report a store that could not be opened. */
  log?: Logger;
}

/**
 * The app-scoped settings store: one row about this workbench. Durable user
 * data like the project registry, and nothing in it is derived, so `DELETE
 * /cache` never touches it.
 *
 * Synchronous throughout, for the same reason the registry is: it is a single
 * row read on request, and `node:sqlite` is synchronous anyway.
 */
export interface SettingsStore {
  /** The database file backing the store, or `null` when it is in memory. */
  readonly path: string | null;
  /** Every setting, filled out with the defaults. */
  get(): AppSettings;
  /**
   * Merge a patch into what is stored and return the result. Throws
   * `InvalidSettingsError` on a value that cannot be stored as written.
   */
  patch(patch: AppSettingsPatch): AppSettings;
  close(): void;
}
