import { resolve } from 'node:path';
import { InvalidSettingsError } from './errors.js';
import {
  DENSITIES,
  THEME_MODES,
  type AIProviderInput,
  type AIProviderInstance,
  type AISettings,
  type AISettingsPatch,
  type AppearanceSettings,
  type AppSettingsPatch,
  type EngineSettings,
  type GateSettings,
  type StoredAppSettings,
} from './types.js';

/** A provider id lands in a URL and in stored settings, so it stays a slug. */
const PROVIDER_ID = /^[a-z0-9][a-z0-9-]*$/;

/** POSIX environment variable names: what a subprocess can actually receive. */
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const HEX_COLOUR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Merge a patch into the stored settings and hand back the new stored value —
 * still sparse, so untouched fields keep following the defaults.
 *
 * Sections merge field by field, and an array replaces the stored one whole.
 * Everything is normalised on the way in (trimmed, blank rows dropped,
 * duplicates collapsed) and refused when it cannot mean anything: a settings
 * screen that posts an empty provider row should not store a provider nobody
 * can launch.
 */
export function applyAppPatch(
  stored: StoredAppSettings,
  patch: AppSettingsPatch,
): StoredAppSettings {
  const next: StoredAppSettings = { ...stored };

  if (patch.appearance) {
    next.appearance = appearance(stored.appearance, patch.appearance);
  }
  if (patch.engine) next.engine = engine(stored.engine, patch.engine);
  if (patch.gates) next.gates = gates(stored.gates, patch.gates);
  if (patch.ai) next.ai = ai(stored.ai, patch.ai);

  return next;
}

function appearance(
  stored: Partial<AppearanceSettings> = {},
  patch: Partial<AppearanceSettings>,
): Partial<AppearanceSettings> {
  const next = { ...stored };
  if (patch.theme !== undefined) {
    next.theme = oneOf(patch.theme, THEME_MODES, 'theme');
  }
  if (patch.density !== undefined) {
    next.density = oneOf(patch.density, DENSITIES, 'density');
  }
  return next;
}

function engine(
  stored: Partial<EngineSettings> = {},
  patch: Partial<EngineSettings>,
): Partial<EngineSettings> {
  const next = { ...stored };
  if (patch.pluginsDir !== undefined) {
    // Absolute, like a project root: the server resolves relative paths
    // against its own working directory, which is not the one a settings
    // screen was typed in.
    next.pluginsDir =
      patch.pluginsDir === null
        ? null
        : resolve(required(patch.pluginsDir, 'plugins directory'));
  }
  if (patch.thirdPartyPlugins !== undefined) {
    next.thirdPartyPlugins = patch.thirdPartyPlugins;
  }
  if (patch.cache !== undefined) next.cache = patch.cache;
  return next;
}

function gates(
  stored: Partial<GateSettings> = {},
  patch: Partial<GateSettings>,
): Partial<GateSettings> {
  const next = { ...stored };
  if (patch.failOnNewCycles !== undefined) {
    next.failOnNewCycles = patch.failOnNewCycles;
  }
  if (patch.hotspotRegression !== undefined) {
    next.hotspotRegression = threshold(patch.hotspotRegression);
  }
  return next;
}

function ai(
  stored: Partial<AISettings> = {},
  patch: AISettingsPatch,
): Partial<AISettings> {
  const next = { ...stored };
  if (patch.healthCheckInterval !== undefined) {
    next.healthCheckInterval = interval(patch.healthCheckInterval);
  }
  if (patch.providers !== undefined) {
    next.providers = providers(patch.providers);
  }
  return next;
}

function threshold(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidSettingsError(
      'The hotspot regression threshold is a percentage of 0 or more — ' +
        'use null for no gate.',
    );
  }
  return value;
}

function interval(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidSettingsError(
      'The health-check interval is a whole number of minutes, 0 or more — ' +
        'use 0 to check only when asked.',
    );
  }
  return value;
}

/** Two cards for one id would be two names for the same provider. */
function providers(values: AIProviderInput[]): AIProviderInstance[] {
  const seen = new Set<string>();
  return values.map((value) => {
    const instance = provider(value);
    if (seen.has(instance.id)) {
      throw new InvalidSettingsError(
        `Two AI providers share the id "${instance.id}".`,
      );
    }
    seen.add(instance.id);
    return instance;
  });
}

function provider(input: AIProviderInput): AIProviderInstance {
  return {
    id: providerId(input.id),
    name: required(input.name, 'provider name'),
    // A provider is off until somebody turns it on: adding a card is not the
    // same decision as letting Strata launch what it points at.
    enabled: input.enabled ?? false,
    accent: colour(input.accent),
    binary: optional(input.binary, 'binary path'),
    home: optional(input.home, 'agent home'),
    shadowHome: optional(input.shadowHome, 'shadow home'),
    // Duplicates and order are meaningful in an argument vector, so only blank
    // rows — what an empty row in a chip list looks like — are dropped.
    args: (input.args ?? []).map((a) => a.trim()).filter(Boolean),
    env: env(input.env ?? {}),
    models: unique((input.models ?? []).map((m) => m.trim()).filter(Boolean)),
  };
}

function providerId(value: string): string {
  const id = required(value, 'provider id');
  if (!PROVIDER_ID.test(id)) {
    throw new InvalidSettingsError(
      `"${id}" is not a usable provider id — use lower-case letters, ` +
        'digits and dashes.',
    );
  }
  return id;
}

function colour(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!HEX_COLOUR.test(trimmed)) {
    throw new InvalidSettingsError(
      `"${value}" is not a colour — use a hex value such as "#4da3ff".`,
    );
  }
  return trimmed;
}

function env(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const name = key.trim();
    if (!ENV_NAME.test(name)) {
      throw new InvalidSettingsError(
        `"${key}" is not an environment variable name.`,
      );
    }
    // The value is kept as written — trimming somebody's token or path
    // separator would be a change they did not ask for.
    out[name] = value;
  }
  return out;
}

function required(value: string, field: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw new InvalidSettingsError(`The ${field} cannot be blank.`);
  return trimmed;
}

/** A field that is either a real value or explicitly unset. */
function optional(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  return required(value, field);
}

function oneOf<T extends string>(
  value: T,
  allowed: readonly T[],
  field: string,
): T {
  if (!allowed.includes(value)) {
    throw new InvalidSettingsError(
      `"${value}" is not a ${field} — pick one of ${allowed.join(', ')}.`,
    );
  }
  return value;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}
