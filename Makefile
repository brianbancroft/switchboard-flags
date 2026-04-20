.PHONY: init up dev setup-hosts

HOSTS_ENTRY = 127.0.0.1 switchboard-dash.local

init:
	@command -v pg_isready >/dev/null 2>&1 || { echo "error: pg_isready not found — is PostgreSQL installed?"; exit 1; }
	@pg_isready -q || { echo "error: PostgreSQL is not running"; exit 1; }
	@if [ -f .env ]; then \
		echo ".env already exists, skipping"; \
	else \
		cp .env.example .env && echo "Created .env from .env.example — edit DATABASE_URL if needed"; \
	fi
	pnpm --filter api db:generate

up:
	pnpm db:migrate

dev:
	pnpm dev

## Adds switchboard-dash.local to /etc/hosts (requires sudo).
setup-hosts:
	@if grep -q 'switchboard-dash.local' /etc/hosts 2>/dev/null; then \
		echo "switchboard-dash.local already in /etc/hosts, skipping"; \
	else \
		echo "Adding switchboard-dash.local to /etc/hosts (requires sudo)..."; \
		echo '$(HOSTS_ENTRY)' | sudo tee -a /etc/hosts > /dev/null; \
		echo "Done — switchboard-dash.local now resolves to 127.0.0.1"; \
	fi
