# SDK

The contracts a plugin implements and the vocabulary every other context
borrows to talk about analysis. Nothing here executes; it is the shape of the
agreement.

## Language

**Stage**:
A unit of work in the analysis pipeline, contributed by a plugin. It declares
what it consumes and what it produces, and the core orders the stages from
those declarations.
_Avoid_: plugin kind, analyzer, pass, phase

**Output type**:
The shape a stage produces — a dependency graph, a metric series, a findings
list, an aggregate. The set is closed and defined here, even though the set of
stages is open. A stage depends on an output type, never on another stage's id.
_Avoid_: result type, payload

**Stage filter**:
The extensions or globs a stage declares it wants files for. The core applies
it, so a stage only ever sees the files it matched — and so do its cache keys.
_Avoid_: claimed files, extensions

**Exclusive group**:
A named set of stages of which at most one may run. A repository has one commit
convention, not several.
_Avoid_: mutex, singleton stage

**Plugin**:
A directory with a manifest that contributes one stage. Built-in and drop-in
plugins are the same thing and get the same privileges.
_Avoid_: extension, module (a module is a unit of the analysed code)

**Plugin manifest**:
The JSON file that declares a plugin to the registry — its id, version, target
SDK, entry module, and everything the core needs to plan a run *without*
importing it: what it consumes, produces, filters on, and is exclusive with.
