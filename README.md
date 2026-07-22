# go-CRM

A modular CRM portal — Turborepo/pnpm monorepo with a Go modular-monolith backend, an Astro + React web app, and a React Native (Expo) mobile app.

## Layout

```
go_CRM/
├── apps/
│   ├── web/            # Astro (marketing/SEO) + React island SPA at /app
│   └── mobile/         # React Native + Expo (EAS build/update)
├── shared/
│   ├── design-tokens/  # Tailwind preset + design tokens (web + mobile)
│   ├── proto/          # gRPC protobuf contracts (internal service comm)
│   └── schemas/        # Shared Zod schemas (web + mobile validation)
├── services/           # Go 1.22+ modular monolith
│   ├── cmd/
│   │   ├── gateway/    # HTTP API edge (Chi + net/http ServeMux)
│   │   └── worker/     # NATS JetStream consumer(s)
│   ├── internal/       # Domain modules (schema-per-domain)
│   │   ├── auth/       # JWT (golang-jwt) + Argon2id hashing
│   │   ├── accounts/
│   │   ├── contacts/
│   │   ├── deals/
│   │   └── activities/
│   ├── pkg/            # Shared infra: config, pgx pool, NATS, middleware
│   └── migrations/     # golang-migrate SQL migrations
└── .github/workflows/  # CI
```

## Stack

**Frontend:** Turborepo + pnpm · Astro + React · TailwindCSS · React Router v6 · React Native + Expo · TanStack Query · Zustand · React Hook Form + Zod

**Backend:** Go 1.22+ · PostgreSQL 16 / Supabase · pgx + sqlc · golang-migrate · Chi · gRPC · NATS JetStream · golang-jwt · Argon2id

## Getting started

```bash
# Frontend workspace
pnpm install
pnpm dev

# Backend
cd services
go mod tidy
go run ./cmd/gateway
```

See `.env.example` for required environment variables.
