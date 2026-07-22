.PHONY: dev build migrate-up migrate-down sqlc proto

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

# Codegen
sqlc:
	cd services && sqlc generate

proto:
	cd shared/proto && buf generate
