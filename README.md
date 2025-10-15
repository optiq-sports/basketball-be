## Optiq Sport Basketball API

A TypeScript/Express backend with Prisma ORM and PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
  - [1) Install dependencies](#1-install-dependencies)
  - [2) Start PostgreSQL with Docker](#2-start-postgresql-with-docker)
  - [3) Configure environment](#3-configure-environment)
  - [4) Prisma: generate and migrate](#4-prisma-generate-and-migrate)
  - [5) Run the app](#5-run-the-app)
- [Database via docker-compose](#database-via-docker-compose)
- [Prisma (ORM)](#prisma-orm)
- [NPM scripts](#npm-scripts)
- [Troubleshooting](#troubleshooting)
- [Future Sections](#future-sections)

## Overview

- **Runtime**: Node.js + TypeScript
- **Web**: Express
- **ORM**: Prisma
- **DB**: PostgreSQL (via Docker)

## Requirements

- Node.js 18+ and npm
- Docker and Docker Compose

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Start PostgreSQL with Docker

```bash
docker compose up -d
```

This brings up `postgres` on `localhost:5432` and `pgAdmin` on `localhost:5050`.

### 3) Configure environment

Create `.env` from `.env-sample` and set `DATABASE_URL`:

```bash
cp .env-sample .env
```

Example content (adjust if you change docker credentials):

```env
DATABASE_URL="postgresql://username:password@localhost:5432/optiq_sport?schema=public"
```

### 4) Prisma: generate and migrate

Generate the Prisma Client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5) Run the app

- Development (watch mode):

```bash
npm run dev
```

- Production build and start:

```bash
npm run start
# or
npm run start:prod
```

## Database via docker-compose

The compose file defines:

- `postgres` (image: `postgres:17.2-alpine`) with a named volume for data persistence
- `pgadmin` on `http://localhost:5050` (default creds set in `docker-compose.yaml`)

Common commands:

```bash
# Start/stop
docker compose up -d
docker compose down

# View logs
docker compose logs -f postgres
```

## Prisma (ORM)

- Generate client after schema changes:

```bash
npx prisma generate
```

- Create/run a development migration:

```bash
npx prisma migrate dev --name some_change
```

- Open Prisma Studio (visual data browser):

```bash
npx prisma studio
```

## NPM scripts

```bash
npm run dev         # nodemon + ts-node (development)
npm run start       # build then start (production flow)
npm run start:prod  # build then node dist/app.js
npm run lint        # lint sources
npm run lint:fix    # fix lint issues
npm run prisma:generate
npm run prisma:migrate
```

## Troubleshooting

- ts-node not found when running dev: ensure dev deps are installed

```bash
npm install --save-dev ts-node @types/node
```

- Database connection fails: confirm Docker is running and `DATABASE_URL` matches `docker-compose.yaml` credentials and port.

## Future Sections

Add more sections below as the project evolves:

- Architecture & module layout
- API reference / OpenAPI
- Auth & security
- Deployment
- Observability (metrics, logs, tracing)
