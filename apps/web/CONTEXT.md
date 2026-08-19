# Web

The workbench in a browser. It presents runs; it invents no analysis
vocabulary of its own — those words come from [Core](../../packages/core/CONTEXT.md)
and the [SDK](../../packages/sdk/CONTEXT.md).

## Language

**Screen**:
One addressable view in the workbench — Overview, Hotspots, Dependencies,
Commit analytics, Dead code — reached from the rail.
_Avoid_: page, tab, view

**Settings scope**:
Which of the two settings areas a screen belongs to: *Project settings*, which
edits the repository's analysis config, or *Settings*, which edits this
workbench's app settings. The rail swaps to the scope's own nav inside either.
_Avoid_: settings level, section (a section is one screen within a scope)

**Selected revision**:
The revision the workbench is currently looking at. View state held by the
browser, not stored configuration — picking a different one is a different run,
not a changed project.

**Recent runs**:
This browser's own log of runs it started, seeded with the one summary the
registry keeps per project. Not a server-side history.
