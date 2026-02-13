SHELL := /bin/bash

COMPOSE := docker compose -f docker-compose.yml
PORT ?= 8000
MODELS_URL ?= http://localhost:$(PORT)/v1/models

.PHONY: up down logs ps test-endpoint

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

test-endpoint:
	curl -fsS "$(MODELS_URL)"
