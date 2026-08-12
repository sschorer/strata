# Module: `@strata/plugin-ai-provider-template` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **ai-provider**.

## 1. Purpose & Goals

A **copy-me template** for wiring an AI backend into Strata (OpenAI, Anthropic,
Ollama, Azure, …). Powers features like "explain this hotspot", NL queries over
the repo, and auto-generated architecture docs.

## 2. Constraints

- Credentials come from the environment (`AI_BASE_URL`, `AI_API_KEY`,
  `AI_MODEL`) — never committed.
- Optional by design: Strata runs fully offline without any provider.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`, `fetch` (global, Node ≥ 20).
- **Consumed by:** AI-driven features (roadmap) via `AIProvider.chat()` /
  optional `embed()`.
- **Manifest:** `strata.plugin.json` (`kind: ai-provider`).

## 4. Building Blocks

- `listModels()` — advertise available models to the settings UI.
- `chat()` — OpenAI-compatible `POST /chat/completions` example.
- `embed()` (optional) — for repo-wide semantic search / RAG.

## 5. Runtime

Features build `ChatMessage[]` and call `chat()`. Point `AI_BASE_URL` at an
OpenAI-compatible endpoint, or at Ollama (`http://localhost:11434/v1`) for a
fully local model.

## 6. Decisions

- **Template, not a hard dependency** — keeps provider SDKs out of the core and
  lets users choose (or self-host) their model.
- **OpenAI-compatible shape** as the default because most providers expose it.

## 7. Quality & Risks

- **Risk:** leaking prompts/code to a third party. **Mitigation:** opt-in, local
  model support, and clear docs.
- **Debt:** streaming and token accounting are not implemented in the template.
