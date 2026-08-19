# Server

The HTTP API over the core. It adds two limits of its own and turns a run into
something a browser can follow; everything else it borrows from
[Core](../core/CONTEXT.md).

## Language

**API token**:
The single shared secret that says *who may call this workbench at all*.
Presented as a bearer credential and checked before a request is routed,
parsed, or resolved.
_Avoid_: API key, password, session

**Allow-list root**:
One of the directories this server may reach on disk. Says *what any caller may
reach*, which is a different question from who may call — holding the token
makes a caller trusted, not unconfined.
_Avoid_: sandbox, browse root, jail

**Browse**:
Listing the subdirectories of one directory on the server's machine, marking
which are git working trees, so a repository can be picked rather than typed.
Directory names only — never files, never contents.
