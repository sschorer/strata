<script lang="ts">
  // Every class below is written out in full: Tailwind scans source text for
  // candidates, so a composed string like `bg-${name}` would never be emitted.
  const surfaces = [
    { token: 'bg', swatch: 'bg-bg' },
    { token: 'surface', swatch: 'bg-surface' },
    { token: 'elevated', swatch: 'bg-elevated' },
    { token: 'line', swatch: 'bg-line' },
    { token: 'line-strong', swatch: 'bg-line-strong' },
  ];

  const accents = [
    { token: 'accent', swatch: 'bg-accent' },
    { token: 'accent-soft', swatch: 'bg-accent-soft' },
    { token: 'ok', swatch: 'bg-ok' },
    { token: 'warn', swatch: 'bg-warn' },
    { token: 'danger', swatch: 'bg-danger' },
  ];

  const heat = [
    { token: 'h1', swatch: 'bg-h1' },
    { token: 'h2', swatch: 'bg-h2' },
    { token: 'h3', swatch: 'bg-h3' },
    { token: 'h4', swatch: 'bg-h4' },
    { token: 'h5', swatch: 'bg-h5' },
  ];

  const text = [
    { token: 'ink', class: 'text-ink' },
    { token: 'muted', class: 'text-muted' },
    { token: 'subtle', class: 'text-subtle' },
    { token: 'accent', class: 'text-accent' },
  ];
</script>

{#snippet row(label: string, entries: { token: string; swatch: string }[])}
  <div>
    <p class="text-subtle mb-2 text-xs">{label}</p>
    <ul class="grid grid-cols-5 gap-2">
      {#each entries as entry (entry.token)}
        <li>
          <div
            class="border-line h-10 rounded-md border {entry.swatch}"
            aria-hidden="true"
          ></div>
          <p class="text-muted mt-1 font-mono text-[11px]">{entry.token}</p>
        </li>
      {/each}
    </ul>
  </div>
{/snippet}

<div class="space-y-5">
  {@render row('Surfaces', surfaces)}
  {@render row('Accent & status', accents)}
  {@render row('Heat ramp — cold h1 → hot h5', heat)}

  <div>
    <p class="text-subtle mb-2 text-xs">Text</p>
    <ul class="flex flex-wrap gap-4">
      {#each text as entry (entry.token)}
        <li class="text-sm {entry.class}">
          {entry.token}
          <span class="font-mono text-[11px] opacity-70">Aa</span>
        </li>
      {/each}
    </ul>
  </div>
</div>
