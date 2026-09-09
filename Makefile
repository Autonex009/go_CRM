.PHONY: dev build migrate-up migrate-down

# Frontend
dev:
	pnpm dev

build:
	pnpm build

# Backend DB (requires golang-migrate + $DATABASE_URL)
migrate-up:
	migrate -path services/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path services/migrations -database "$(DATABASE_URL)" down 1
