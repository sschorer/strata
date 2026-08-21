<script lang="ts">
  /**
   * Why the last run produced nothing, in the slot the run's summary would
   * have filled.
   *
   * A run can fail before it has anything to report — a configuration naming a
   * plugin nobody loaded is the ordinary case, and it fails deliberately rather
   * than handing back a report with a hole in it. So the header cannot fall
   * back to the previous run's chips: they would describe an older revision
   * under a *Re-analyze* button that has just refused, and the reader would
   * have no way of telling that anything went wrong.
   *
   * The message is the server's, kept whole in the tooltip: it names the plugin
   * and the setting that asked for it, which is more than fits in a header.
   */

  interface Props {
    message: string;
  }

  let { message }: Props = $props();
</script>

<p
  class="text-danger max-w-56 truncate text-xs sm:max-w-72"
  role="alert"
  title={message}
>
  <span class="font-medium">Run failed</span> · {message}
</p>
