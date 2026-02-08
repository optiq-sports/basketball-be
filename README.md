# Basketball Management Platform - Backend API

A high-performance NestJS backend for managing basketball tournaments, teams, players, and matches with role-based authentication.

## 🏀 Overview

This is a **basketball tournament management and statistics platform** backend built with:
- **Framework**: NestJS (TypeScript)
- **Runtime**: Bun (or Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT with role-based access control

## 📋 Features

### ✅ Implemented (Current Phase)

- **Role-Based Authentication**
  - JWT-based authentication
  - Roles: `ADMIN`, `STATISTICIAN`
  - Secure password hashing with bcrypt
  - Session management

- **CRUD Operations**
  - **Players**: Full CRUD with team association, jersey number validation
  - **Teams**: Full CRUD with unique team codes, coach management
  - **Tournaments**: Full CRUD with automatic code generation, team management
  - **Matches**: Full CRUD with score tracking, quarter-by-quarter stats

### 🎯 API Endpoints

All endpoints are prefixed with `/api`

#### Authentication (`/api/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/profile` - Get current user profile (protected)

#### Players (`/api/players`)
- `GET /players` - List all players (optional `?teamId=xxx` filter)
- `GET /players/:id` - Get player details
- `POST /players` - Create player (ADMIN/STATISTICIAN)
- `PATCH /players/:id` - Update player (ADMIN/STATISTICIAN)
- `DELETE /players/:id` - Delete player (ADMIN only)

#### Teams (`/api/teams`)
- `GET /teams` - List all teams
- `GET /teams/:id` - Get team details with players
- `POST /teams` - Create team (ADMIN/STATISTICIAN)
- `PATCH /teams/:id` - Update team (ADMIN/STATISTICIAN)
- `DELETE /teams/:id` - Delete team (ADMIN only)

#### Tournaments (`/api/tournaments`)
- `GET /tournaments` - List all tournaments
- `GET /tournaments/:id` - Get tournament details
- `GET /tournaments/code/:code` - Get tournament by code
- `POST /tournaments` - Create tournament (ADMIN/STATISTICIAN)
- `PATCH /tournaments/:id` - Update tournament (ADMIN/STATISTICIAN)
- `POST /tournaments/:id/teams` - Add teams to tournament
- `DELETE /tournaments/:id/teams/:teamId` - Remove team from tournament
- `DELETE /tournaments/:id` - Delete tournament (ADMIN only)

#### Matches (`/api/matches`)
- `GET /matches` - List matches (optional `?tournamentId=xxx&status=xxx`)
- `GET /matches/:id` - Get match details with stats
- `POST /matches` - Create match (ADMIN/STATISTICIAN)
- `PATCH /matches/:id` - Update match scores/stats (ADMIN/STATISTICIAN)
- `DELETE /matches/:id` - Delete match (ADMIN only)

## 🚀 Quick Start

### Prerequisites

- **Bun** (recommended) or **Node.js 18+**
- **Docker** and **Docker Compose**
- **PostgreSQL** (via Docker)

### 1) Install Dependencies

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### 2) Start PostgreSQL with Docker

```bash
docker compose up -d
```

This brings up:
- `postgres` on `localhost:5432`
- `pgAdmin` on `http://localhost:5050`

### 3) Configure Environment

Create `.env` from `.env-sample`:

```bash
cp .env-sample .env
```

Update the `.env` file with your configuration:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/optiq_sport?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3000
```

### 4) Setup Database

Generate Prisma Client and run migrations:

```bash
# Generate Prisma Client
bun run prisma:generate
# or
npm run prisma:generate

# Run migrations
bun run prisma:migrate
# or
npm run prisma:migrate
```

### 5) Run the Application

**Development mode (with hot reload):**

```bash
bun run start:dev
# or
npm run start:dev
```

**Production mode:**

```bash
# Build
bun run build
# or
npm run build

# Start
bun run start:prod
# or
npm run start:prod
```

The API will be available at `http://localhost:3000/api`

## 📊 Database Management

### Prisma Commands

```bash
# Generate Prisma Client
bun run prisma:generate

# Create and run migration
bun run prisma:migrate

# Open Prisma Studio (visual database browser)
bun run prisma:studio
```

### Database via Docker Compose

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f postgres

# Access pgAdmin
# Open http://localhost:5050
# Email: email@optiqsport.com
# Password: password
```

## 🔐 Authentication & Authorization

### Roles

- **ADMIN**: Full access to all resources
- **STATISTICIAN**: Can create/update players, teams, tournaments, and matches

### Using Authentication

1. **Register a user:**
```bash
POST /api/auth/register
{
  "email": "admin@example.com",
  "password": "password123",
  "role": "ADMIN"
}
```

2. **Login:**
```bash
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password123"
}
```

3. **Use the token:**
Include the `access_token` in the Authorization header:
```
Authorization: Bearer <access_token>
```

## 📁 Project Structure

```
src/
├── auth/              # Authentication module
│   ├── decorators/    # Custom decorators (Roles, CurrentUser)
│   ├── dto/           # Data Transfer Objects
│   ├── guards/        # Auth guards (JWT, Roles, Local)
│   ├── strategies/    # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── players/           # Players module
├── teams/             # Teams module
├── tournaments/       # Tournaments module
├── matches/           # Matches module
├── prisma/            # Prisma service
├── app.module.ts      # Root module
└── main.ts            # Application entry point
```

## 🛠️ Available Scripts

```bash
# Development
bun run start:dev      # Start in watch mode
bun run start:debug    # Start in debug mode

# Production
bun run build          # Build the project
bun run start:prod     # Start production server

# Database
bun run prisma:generate    # Generate Prisma Client
bun run prisma:migrate     # Run migrations
bun run prisma:studio      # Open Prisma Studio

# Code Quality
bun run lint           # Lint code
bun run format         # Format code with Prettier
```

## 🧪 Testing

```bash
# Unit tests
bun run test

# E2E tests
bun run test:e2e

# Test coverage
bun run test:cov
```

## 📝 API Documentation

The API follows RESTful conventions. All endpoints require authentication except:
- `POST /api/auth/register`
- `POST /api/auth/login`

### Example Request

```bash
# Create a team
curl -X POST http://localhost:3000/api/teams \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lakers",
    "code": "LAL",
    "color": "#552583"
  }'
```

## 🔧 Troubleshooting

### Database Connection Issues

1. Ensure Docker is running
2. Check that PostgreSQL container is up: `docker compose ps`
3. Verify `DATABASE_URL` in `.env` matches docker-compose credentials

### Prisma Client Not Found

```bash
bun run prisma:generate
```

### Port Already in Use

Change the `PORT` in `.env` file or stop the process using port 3000.

## 🚧 Future Enhancements

- [ ] Match statistics tracking (points, rebounds, assists per player)
- [ ] Shot chart data storage
- [ ] Tournament standings calculation
- [ ] Player performance analytics
- [ ] Real-time score updates (WebSocket)
- [ ] File upload for team logos and player photos
- [ ] Email notifications
- [ ] API rate limiting
- [ ] Swagger/OpenAPI documentation

## 📄 License

ISC

## 👥 Author

Optiq Sport

---

**Note**: This is the backend implementation for Phase 1, focusing on authentication and core CRUD operations. Future phases will include advanced statistics, analytics, and real-time features.
