<script lang="ts">
  import CurrentProject from './CurrentProject.svelte';
  import Logo from './Logo.svelte';
  import NavList from './NavList.svelte';
  import PluginCount from './PluginCount.svelte';
  import { ANALYSIS_NAV, SETTINGS_NAV } from './nav';

  interface Props {
    pathname: string;
  }

  let { pathname }: Props = $props();
</script>

<!--
  The rail owns the whole window height and never scrolls with the content: on
  a narrow screen there is no room for it, and the header carries the same nav
  as a strip instead.
-->
<aside
  class="border-line bg-surface hidden w-60 shrink-0 flex-col border-r md:flex lg:w-64"
>
  <div class="px-4 py-4">
    <Logo />
  </div>

  <div class="px-3 pb-2">
    <CurrentProject />
  </div>

  <nav class="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Workbench">
    <p class="text-subtle px-3 pb-1 text-[0.625rem] tracking-wide uppercase">
      Analysis
    </p>
    <NavList items={ANALYSIS_NAV} {pathname} label="Analysis" />

    <p class="text-subtle px-3 pt-5 pb-1 text-[0.625rem] tracking-wide uppercase">
      Settings
    </p>
    <NavList items={SETTINGS_NAV} {pathname} label="Settings" />
  </nav>

  <div class="border-line border-t px-4 py-3">
    <PluginCount />
  </div>
</aside>
