import { mount, unmount, type Component } from 'svelte';

export interface Rendered {
  /** The element the component was mounted into. */
  container: HTMLElement;
  destroy(): void;
}

/**
 * Mount a component into a detached container for a test. Small on purpose —
 * the assertions read the DOM directly, so there is nothing else to learn.
 */
export function render<Props extends Record<string, unknown>>(
  component: Component<Props>,
  props: Props = {} as Props,
): Rendered {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const instance = mount(component, { target: container, props });

  return {
    container,
    destroy() {
      void unmount(instance);
      container.remove();
    },
  };
}
