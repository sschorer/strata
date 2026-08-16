<script lang="ts">
  import { activeNav, type NavItem } from './nav';

  interface Props {
    items: readonly NavItem[];
    /** The route the app is on; decides which entry is current. */
    pathname: string;
    /** `column` in the rail, `row` in the narrow-screen strip. */
    orientation?: 'column' | 'row';
    label?: string;
  }

  let { items, pathname, orientation = 'column', label }: Props = $props();

  let current = $derived(activeNav(pathname)?.href ?? null);
  let base = $derived(
    orientation === 'column'
      ? 'w-full justify-between px-3 py-2'
      : 'shrink-0 gap-2 px-3 py-1.5',
  );
</script>

<ul
  class={orientation === 'column'
    ? 'space-y-0.5'
    : 'flex gap-1 overflow-x-auto'}
  aria-label={label}
>
  {#each items as item (item.href)}
    <li>
      {#if item.status === 'planned'}
        <!-- On the backlog: shown so the map is complete, inert so it cannot
             lead anywhere that is not there yet. -->
        <span
          class="text-subtle flex cursor-not-allowed items-center rounded-lg text-sm {base}"
          aria-disabled="true"
          title="Not built yet"
        >
          <span class="truncate">{item.label}</span>
          <span class="text-subtle ml-2 text-[0.625rem] tracking-wide uppercase"
            >soon</span
          >
        </span>
      {:else}
        <a
          href={item.href}
          aria-current={current === item.href ? 'page' : undefined}
          class="flex items-center rounded-lg text-sm transition-colors {base}
                 {current === item.href
            ? 'bg-accent-soft text-ink font-medium'
            : 'text-muted hover:bg-elevated hover:text-ink'}"
        >
          <span class="truncate">{item.label}</span>
        </a>
      {/if}
    </li>
  {/each}
</ul>
