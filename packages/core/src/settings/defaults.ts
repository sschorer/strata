import type {
  AIProviderInstance,
  AppSettings,
  StoredAppSettings,
} from './types.js';

/**
 * How the workbench behaves before anyone configures it: the OS theme, the
 * middle density, the plugins directory the environment names, third-party
 * plugins and the incremental cache on, no CI gate, no AI provider. Exactly
 * what the server did before there were app settings.
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  appearance: { theme: 'system', density: 'balanced' },
  engine: { pluginsDir: null, thirdPartyPlugins: true, cache: true },
  gates: { failOnNewCycles: false, hotspotRegression: null },
  ai: { healthCheckInterval: 0, providers: [] },
};

/**
 * Fill a stored (sparse) settings object out to a whole one. Everything is
 * copied on the way out, so a caller cannot mutate the defaults — or the
 * store's own state — through the value it gets back.
 */
export function withAppDefaults(stored: StoredAppSettings): AppSettings {
  const { appearance, engine, gates, ai } = DEFAULT_APP_SETTINGS;
  return {
    appearance: { ...appearance, ...stored.appearance },
    engine: { ...engine, ...stored.engine },
    gates: { ...gates, ...stored.gates },
    ai: {
      healthCheckInterval:
        stored.ai?.healthCheckInterval ?? ai.healthCheckInterval,
      providers: (stored.ai?.providers ?? ai.providers).map(copyProvider),
    },
  };
}

function copyProvider(provider: AIProviderInstance): AIProviderInstance {
  return {
    ...provider,
    args: [...provider.args],
    env: { ...provider.env },
    models: [...provider.models],
  };
}
