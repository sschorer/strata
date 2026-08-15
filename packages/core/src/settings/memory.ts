import { withAppDefaults } from './defaults.js';
import { applyAppPatch } from './patch.js';
import type {
  AppSettings,
  AppSettingsPatch,
  SettingsStore,
  StoredAppSettings,
} from './types.js';

/**
 * Settings that live for as long as the process does — what a workbench falls
 * back to when the database cannot be opened (a read-only container, a file
 * written by a newer Strata). Every screen works; nothing survives a restart,
 * and the warning at open time says so.
 *
 * Also what the store tests and callers use when they want no file at all.
 */
export function memorySettingsStore(): SettingsStore {
  let stored: StoredAppSettings = {};

  return {
    path: null,
    get: () => withAppDefaults(stored),
    patch(patch: AppSettingsPatch): AppSettings {
      stored = applyAppPatch(stored, patch);
      return withAppDefaults(stored);
    },
    close: () => {},
  };
}
