/**
 * Props a test can change after mounting.
 *
 * `render` hands a component its props once; a component's *reaction* to props
 * changing — which is where reactivity bugs live — needs them to be reactive.
 * Runes only compile in `.svelte`/`.svelte.ts`, hence the module.
 */
export function reactiveProps<T extends Record<string, unknown>>(initial: T): T {
  const props = $state(initial);
  return props;
}
