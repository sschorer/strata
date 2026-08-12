# Strata — developer entry point.
# Every action a dev needs in this repo lives here. Run `make` or `make help`.

SHELL := /bin/bash
PNPM  := pnpm

# Args for parametrised targets:
#   make analyze REPO=/path/to/repo [LIMIT=500]
#   make new-plugin NAME=python KIND=language
REPO  ?=
LIMIT ?= 500
NAME  ?=
KIND  ?=

.DEFAULT_GOAL := help

## ─────────────────────────────── Help ───────────────────────────────

.PHONY: help
help: ## Show this help
	@echo "Strata — make targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ──────────────────────────── Lifecycle ─────────────────────────────

.PHONY: install
install: ## Install all workspace dependencies
	$(PNPM) install

.PHONY: build
build: ## Build every package and plugin
	$(PNPM) -r build

.PHONY: clean
clean: ## Remove build output and caches
	$(PNPM) -r exec rm -rf dist .tsbuildinfo || true
	rm -rf coverage .strata

.PHONY: distclean
distclean: clean ## clean + remove all node_modules
	rm -rf node_modules packages/*/node_modules plugins/*/node_modules apps/*/node_modules

## ───────────────────────────── Develop ──────────────────────────────

.PHONY: dev
dev: ## Run the API server in watch mode
	$(PNPM) --filter @strata/server dev

.PHONY: analyze
analyze: ## Analyze a repo: make analyze REPO=/path/to/repo [LIMIT=500]
	@test -n "$(REPO)" || (echo "REPO=/path/to/repo is required" && exit 1)
	node scripts/analyze.mjs "$(REPO)" "$(LIMIT)"

.PHONY: new-plugin
new-plugin: ## Scaffold a plugin: make new-plugin NAME=python KIND=language
	@test -n "$(NAME)" -a -n "$(KIND)" || (echo "NAME=... KIND=language|commit-convention|git-metric|ai-provider required" && exit 1)
	node scripts/new-plugin.mjs "$(NAME)" "$(KIND)"

## ────────────────────────────── Quality ─────────────────────────────

.PHONY: lint
lint: ## Lint the whole repo
	$(PNPM) lint

.PHONY: lint-fix
lint-fix: ## Lint and auto-fix
	$(PNPM) exec eslint . --fix

.PHONY: typecheck
typecheck: ## Type-check every package
	$(PNPM) typecheck

.PHONY: test
test: ## Run the test suite once
	$(PNPM) test

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	$(PNPM) exec vitest

.PHONY: check
check: build typecheck lint test ## Full local gate (what CI runs)
	@echo "✓ all checks passed"

## ─────────────────────────── Commits / release ──────────────────────

.PHONY: commitlint
commitlint: ## Validate commit messages on the current branch vs origin/main
	$(PNPM) exec commitlint --from origin/main --to HEAD --verbose

.PHONY: release-check
release-check: ## Preview the next release from conventional commits (dry run)
	$(PNPM) dlx release-please release-pr \
		--dry-run --repo-url=$$(git remote get-url origin) \
		--config-file=release-please-config.json \
		--manifest-file=.release-please-manifest.json || \
		echo "(release-please dry run needs a token for full output; commits drive the version)"

## ────────────────────────────── Docker ──────────────────────────────

.PHONY: docker-build
docker-build: ## Build the Docker image locally (tag: strata:local)
	docker build -t strata:local .

.PHONY: docker-run
docker-run: ## Run the local image on :4000
	docker run --rm -p 4000:4000 strata:local

.PHONY: up
up: ## Start the stack via docker compose
	docker compose up --build

.PHONY: down
down: ## Stop the docker compose stack
	docker compose down
