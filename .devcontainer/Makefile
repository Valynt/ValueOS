# Makefile for ValueOS Development Environment
# Provides convenient commands for common operations

.PHONY: help up down restart logs ps clean build migrate migrate-dry health test

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)ValueOS Development Environment$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

up: ## Start all services
	@echo "$(BLUE)Starting all services...$(NC)"
	docker compose up -d
	@echo "$(GREEN)✅ Services started$(NC)"
	@$(MAKE) health

down: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker compose down
	@echo "$(GREEN)✅ Services stopped$(NC)"

restart: ## Restart all services
	@echo "$(BLUE)Restarting all services...$(NC)"
	docker compose restart
	@echo "$(GREEN)✅ Services restarted$(NC)"

logs: ## View logs from all services
	docker compose logs -f

logs-postgres: ## View PostgreSQL logs
	docker compose logs -f postgres

logs-redis: ## View Redis logs
	docker compose logs -f redis

logs-kong: ## View Kong logs
	docker compose logs -f kong

logs-agents: ## View all agent logs
	docker compose logs -f opportunity-agent target-agent realization-agent expansion-agent

ps: ## Show running services
	@docker compose ps

clean: ## Stop and remove all containers, volumes, and networks
	@echo "$(RED)⚠️  This will remove all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v --remove-orphans; \
		echo "$(GREEN)✅ Cleaned up$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

build: ## Build all containers
	@echo "$(BLUE)Building all containers...$(NC)"
	docker compose build
	@echo "$(GREEN)✅ Build complete$(NC)"

rebuild: ## Rebuild all containers from scratch
	@echo "$(BLUE)Rebuilding all containers...$(NC)"
	docker compose build --no-cache
	@echo "$(GREEN)✅ Rebuild complete$(NC)"

migrate: ## Apply database migrations
	@echo "$(BLUE)Applying database migrations...$(NC)"
	bash ../infra/scripts/apply_migrations.sh
	@echo "$(GREEN)✅ Migrations applied$(NC)"

migrate-dry: ## Dry run of database migrations
	@echo "$(BLUE)Dry run of database migrations...$(NC)"
	bash ../infra/scripts/apply_migrations.sh --dry-run

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@bash scripts/post-start.sh

db-shell: ## Open PostgreSQL shell
	@docker compose exec postgres psql -U valueos -d valueos_dev

db-backup: ## Backup database
	@echo "$(BLUE)Backing up database...$(NC)"
	@mkdir -p backups
	@docker compose exec -T postgres pg_dump -U valueos valueos_dev > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Database backed up to backups/$(NC)"

db-restore: ## Restore database from latest backup
	@echo "$(BLUE)Restoring database from latest backup...$(NC)"
	@LATEST=$$(ls -t backups/*.sql | head -1); \
	if [ -z "$$LATEST" ]; then \
		echo "$(RED)❌ No backups found$(NC)"; \
		exit 1; \
	fi; \
	echo "Restoring from $$LATEST"; \
	docker compose exec -T postgres psql -U valueos -d valueos_dev < $$LATEST
	@echo "$(GREEN)✅ Database restored$(NC)"

redis-cli: ## Open Redis CLI
	@docker compose exec redis redis-cli -a $${REDIS_PASSWORD:-valueos_dev}

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	pnpm test

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	pnpm lint

format: ## Format code
	@echo "$(BLUE)Formatting code...$(NC)"
	pnpm format

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	pnpm install
	@echo "$(GREEN)✅ Dependencies installed$(NC)"

dev: ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	pnpm dev

studio: ## Open Supabase Studio
	@echo "$(BLUE)Opening Supabase Studio...$(NC)"
	@open http://localhost:54324 || xdg-open http://localhost:54324 || echo "Open http://localhost:54324 in your browser"

frontend: ## Open frontend
	@echo "$(BLUE)Opening frontend...$(NC)"
	@open http://localhost:3001 || xdg-open http://localhost:3001 || echo "Open http://localhost:3001 in your browser"

agents-status: ## Check agent status
	@echo "$(BLUE)Checking agent status...$(NC)"
	@echo "Opportunity Agent:"
	@curl -s http://localhost:8081/health | jq . || echo "$(RED)Not responding$(NC)"
	@echo "\nTarget Agent:"
	@curl -s http://localhost:8082/health | jq . || echo "$(RED)Not responding$(NC)"
	@echo "\nRealization Agent:"
	@curl -s http://localhost:8083/health | jq . || echo "$(RED)Not responding$(NC)"
	@echo "\nExpansion Agent:"
	@curl -s http://localhost:8084/health | jq . || echo "$(RED)Not responding$(NC)"

nats-monitor: ## Open NATS monitoring dashboard
	@echo "$(BLUE)Opening NATS monitor...$(NC)"
	@open http://localhost:8222 || xdg-open http://localhost:8222 || echo "Open http://localhost:8222 in your browser"

kong-admin: ## Open Kong admin API
	@echo "$(BLUE)Opening Kong admin...$(NC)"
	@open http://localhost:8001 || xdg-open http://localhost:8001 || echo "Open http://localhost:8001 in your browser"

env-check: ## Check environment configuration
	@echo "$(BLUE)Checking environment configuration...$(NC)"
	@if [ -f .env ]; then \
		echo "$(GREEN)✅ .env file exists$(NC)"; \
		echo "$(YELLOW)Environment variables:$(NC)"; \
		grep -v '^#' .env | grep -v '^$$' | sed 's/=.*/=***/' | head -20; \
	else \
		echo "$(RED)❌ .env file not found$(NC)"; \
		echo "$(YELLOW)Run: cp .env.template .env$(NC)"; \
	fi

reset: down clean up migrate ## Full reset (stop, clean, start, migrate)
	@echo "$(GREEN)✅ Full reset complete$(NC)"
