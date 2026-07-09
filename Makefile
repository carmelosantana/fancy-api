.DEFAULT_GOAL := help
.PHONY: help install dev build test e2e seed typecheck \
	up down logs restart clean nuke

## ---- Local development --------------------------------------------------

help: ## Show this help
	@echo "Fancy — make targets"
	@echo ""
	@echo "Local development:"
	@grep -E '^(install|dev|build|test|e2e|seed|typecheck):.*## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Docker (self-hosting):"
	@grep -E '^(up|down|logs|restart|clean|nuke):.*## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Golden path: make up && make logs"

install: ## Install workspace dependencies (pnpm)
	@pnpm install

dev: install ## Seed the local dev DB, then run the web app dev server
	@pnpm seed
	@pnpm --filter web dev

build: ## Production build of the web app (next build)
	@pnpm build

test: ## Run the unit test suite (vitest)
	@pnpm test

e2e: ## Run the Playwright end-to-end suite
	@pnpm e2e

seed: ## Populate the hello-tony demo API against the local dev DB
	@pnpm seed

typecheck: ## Typecheck every workspace package
	@pnpm typecheck

## ---- Docker (self-hosting) -----------------------------------------------

up: ## Build (if needed) and start the stack in the background
	@docker compose up -d --build

down: ## Stop the stack (keeps data)
	@docker compose down

logs: ## Follow the web service's logs
	@docker compose logs -f web

restart: ## Restart the web service
	@docker compose restart web

clean: down ## Stop the stack AND delete the persisted data volume
	@echo "This will permanently delete the fancy-data volume (all APIs, records, tokens)."
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || (echo "Aborted."; exit 1)
	@docker volume rm fancy_fancy-data 2>/dev/null || true
	@echo "Data volume removed."

nuke: clean ## clean, plus prune dangling build caches/images for this project
	@docker image rm fancy:latest 2>/dev/null || true
	@docker builder prune -f --filter label=com.docker.compose.project=fancy 2>/dev/null || true
	@echo "Build caches pruned."
