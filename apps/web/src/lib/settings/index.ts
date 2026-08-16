export { default as GeneralScreen } from './GeneralScreen.svelte';
export { default as SettingsNav } from './SettingsNav.svelte';
export { default as SettingsScreen } from './SettingsScreen.svelte';
export {
  projectConfig,
  ProjectConfigStore,
  type ProjectConfigStatus,
} from './config.svelte';
export {
  checkGeneral,
  generalChanged,
  generalForm,
  NAME_MAX,
  type GeneralCheck,
  type GeneralForm,
  type GeneralPatch,
} from './general';
export { scopeHeading, type ScopeHeading } from './heading';
export {
  APP_SECTIONS,
  PROJECT_SECTIONS,
  sectionsFor,
  type SettingsSection,
} from './sections';
export {
  settingsScope,
  SETTINGS_ROOTS,
  SETTINGS_SCOPES,
  type SettingsScope,
} from './scope';
