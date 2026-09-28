This document outlines the architectural changes required to transform the Optiq Sports backend from a single-tenant system into a multi-tenant platform. This empowers external clients (leagues, schools, organizations) to “own” their games, teams, and players while still being serviced by Optiq Sports statisticians and admins.

Data is securely siloed per client, while specific advanced statistics (e.g., shot charts, efficiency ratings) can be kept private and hidden from public consumer APIs.

---

## 1. High-Level Architecture

The system will employ a **Logical Separation** (Row-Level Multi-Tenancy) approach. All clients will share the same PostgreSQL database, but every relevant domain entity will be strictly tagged with a `clientId`.

### Key Components:

- **Core Backend (NestJS):** Handles business logic, internal Admin APIs (using JWT), and external Client APIs (using API Keys).
- **Optiq Admin Panel:** The existing dashboard used by SuperAdmins, Admins, and Statisticians to record data.
- **Client Facing Layer:**
    - **iFrame Widgets:** Hosted by Optiq Sports, embeddable by clients on their own sites.
    - **Client API:** External REST endpoints secured via API keys.
    - **Real-time Engine:** WebSocket/SSE for live scoreboards.

---

## 2. Database Schema Changes (Prisma)

We introduce a `Client` entity and link it to users and domain entities. **Entities will be strictly isolated per client**—a `Team` or `Player` belongs to exactly one `Client`.

### New Models

```
model Client {
  id          String   @id @default(cuid()) @map("id")
  name        String   @map("name")
  websiteUrl  String?  @map("website_url")
  logo        String?  @map("logo")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  users       User[]
  apiKeys     ClientApiKey[]
  tournaments Tournament[]
  teams       Team[]
  players     Player[]
  matches     Match[]

  @@map("client")
}

model ClientApiKey {
  id        String   @id @default(cuid()) @map("id")
  clientId  String   @map("client_id")
  keyHash   String   @unique @map("key_hash") // Hashed API key
  name      String   @map("name")             // e.g., "Production Website"
  createdAt DateTime @default(now()) @map("created_at")
  lastUsed  DateTime? @map("last_used")

  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@map("client_api_key")
}
```

### Modified Models (Adding `clientId`)

- **`User`**: Add `clientId String?`.
    - *SuperAdmins* have `clientId = null` (Global access).
    - *Admins & Statisticians* belong to a specific `Client`.
- **`Tournament`, `Team`, `Player`, `Match`**: Add `clientId String` to all core domain models to enforce strict data siloing.

---

## 3. Roles & Permissions (Authorization)

Authentication will continue using JWTs, but Authorization logic will be upgraded to enforce tenant isolation via a Global Tenant Guard/Interceptor in NestJS.

- **`SUPER_ADMIN`**: Optiq global access. Can create `Clients`, generate API Keys, and assign the first `ADMIN` to a client.
- **`ADMIN`**: Inherits the `clientId` from their user record. Can manage Tournaments, Teams, Players, and Matches **strictly where `entity.clientId === user.clientId`**. Can create/invite `STATISTICIAN`s for their client.
- **`STATISTICIAN`**: Bound to a `clientId`. Can only read client data and strictly write to matches where `match.statisticianId === user.id`.

---

## 4. Advanced Data Privacy

Clients require the ability to hide certain advanced metrics (e.g., efficiency ratings, complex shot charts) from public view, while basic box scores remain public.

Instead of hiding entire matches, we handle this at the API Serialization level:

- **Internal APIs (Admin Panel):** Return 100% of the data, as Optiq admins/statisticians need full access to record and verify data.
- **External Client APIs & iFrames:** Utilize a Data Transfer Object (DTO) filter. Basic properties (Points, Rebounds, Assists) are always serialized. Advanced properties (Shot coordinates, PER) are stripped out of the response payload unless the requesting API key is flagged with an “Advanced Analytics” scope.

---

## 5. Data Migration Strategy

To seamlessly upgrade the existing single-tenant database without losing data:

1. A migration script will create a default client named **“Optiq Sports Internal”**.
2. All existing `User`, `Tournament`, `Team`, `Player`, and `Match` records will have their `clientId` backfilled to point to the new “Optiq Sports Internal” client.
3. SuperAdmins will retain global access (clientId = null) to continue managing the system.

---

## 6. User Flows

### Flow 1: SuperAdmin Onboarding a New Client

1. Optiq SuperAdmin logs into the Admin Panel.
2. Navigates to “Clients” -> “Create New Client”.
3. Enters client details (e.g., “EuroLeague Basketball”, logo, website).
4. SuperAdmin creates a new user with role `ADMIN` and assigns them to the “EuroLeague Basketball” client.
5. SuperAdmin generates an API Key for the client to use on their website.

### Flow 2: Client Admin Setting up a Tournament

1. The new Client Admin logs in. The backend detects their `clientId`.
2. Admin creates a new `Tournament`, `Teams`, and `Players`. All these records are automatically tagged with their `clientId` by the backend.
3. Admin creates a `Match` and assigns it to a `STATISTICIAN` belonging to their client.
4. If this Admin tries to view teams belonging to “Optiq Sports Internal”, the API strictly rejects the request (Tenant Isolation).

### Flow 3: Statistician Scoring a Game

1. Statistician logs into the Optiq mobile/web app.
2. They see their assigned matches (filtered by both their `userId` and `clientId`).
3. They enter the match and log realtime `GameEvent`s (e.g., 2pt Field Goal).
4. The backend verifies they have access to modify this match and processes the event.

### Flow 4: End-Users Viewing Live Stats on Client Website

1. The client has embedded Optiq’s generic `<iframe src="https://widgets.optiqsports.com/live/match-123?apiKey=..."></iframe>` on their website.
2. The widget connects to Optiq’s WebSocket Server: `wss://api.optiqsports.com/live`.
3. The connection joins `room_match_123`.
4. The WebSocket server verifies the API key belongs to the client who owns `match-123`.
5. As the Statistician logs events (Flow 3), the backend pushes updates to `room_match_123`.
6. The widget instantly updates the scoreboard. Advanced stats are filtered out by the backend before emission, maintaining data privacy.

---

## 7. Development Roadmap

1. **Phase 1: Database & Tenant Foundation**
    - Apply Prisma schema changes and run the “Optiq Sports Internal” data migration script.
2. **Phase 2: Security & Isolation**
    - Implement NestJS Guards/Interceptors to automatically scope all internal API queries by `clientId`.
3. **Phase 3: B2B External APIs**
    - Implement API key generation and management.
    - Build the `/api/v1/client/*` read-only external API module with the Advanced Data Privacy DTO filters.
4. **Phase 4: Real-time & Widgets**
    - Update WebSocket gateways for secure external client subscriptions.
    - Develop the embeddable web widget views (Scoreboard, Boxscore).

Here is the corrected document incorporating all of your requirements.

I've updated the architecture so that `Teams` and `Players` are global entities, `Admins` can manage them and assign them to their client-specific tournaments, and `Statisticians` can handle multiple tournaments or jump straight into a match using a "Match Key".

---

# Optiq Sports Multi-Tenancy Architecture Design

This document outlines the architectural changes required to transform the Optiq Sports backend from a single-tenant system into a multi-tenant platform. This empowers external clients (leagues, schools, organizations) to “own” their games and tournaments while still being serviced by Optiq Sports statisticians and admins.

Data is securely siloed per client for tournaments and matches, while specific advanced statistics (e.g., shot charts, efficiency ratings) can be kept private and hidden from public consumer APIs. Teams and Players remain global to allow participation across multiple tournaments.

---

## 1. High-Level Architecture

The system will employ a **Logical Separation** (Row-Level Multi-Tenancy) approach for client-specific entities like Tournaments. All clients will share the same PostgreSQL database.

### Key Components:

- **Core Backend (NestJS):** Handles business logic, internal Admin APIs (using JWT), and external Client APIs (using API Keys).
- **Optiq Admin Panel:** The dashboard used by SuperAdmins, Admins, and Statisticians to record data.
- **Client Facing Layer:**
    - **iFrame Widgets:** Hosted by Optiq Sports, embeddable by clients on their own sites.
    - **Client API:** External REST endpoints secured via API keys.
    - **Real-time Engine:** WebSocket/SSE for live scoreboards.

---

## 2. Database Schema Changes (Prisma)

We introduce a `Client` entity and link it to users and tournaments. **Tournaments and Matches will be isolated per client**, but **Teams and Players are global**—meaning they can participate in multiple tournaments, even across different clients.

### New Models

```
model Client {
  id          String   @id @default(cuid()) @map("id")
  name        String   @map("name")
  websiteUrl  String?  @map("website_url")
  logo        String?  @map("logo")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  users       User[]
  apiKeys     ClientApiKey[]
  tournaments Tournament[]

  @@map("client")
}

model ClientApiKey {
  id        String   @id @default(cuid()) @map("id")
  clientId  String   @map("client_id")
  keyHash   String   @unique @map("key_hash") // Hashed API key
  name      String   @map("name")             // e.g., "Production Website"
  createdAt DateTime @default(now()) @map("created_at")
  lastUsed  DateTime? @map("last_used")

  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@map("client_api_key")
}
```

### Modified Models

- **`User`**: Add `clientId String?`.
    - *SuperAdmins* have `clientId = null` (Global access).
    - *Admins* belong to a specific `Client`.
    - *Statisticians* can be assigned to multiple tournaments and do not necessarily need a strict single `clientId`.
- **`Tournament` & `Match`**: Add `clientId String` to enforce data siloing for competitions.
- **`Match`**: Add a `matchKey String? @unique` to allow Statisticians quick access.
- **`Team` & `Player`**: Remain global (no `clientId` added). They are linked to tournaments through junction tables.

---

## 3. Roles & Permissions (Authorization)

Authentication will continue using JWTs, but Authorization logic will be upgraded to enforce tenant isolation and role rules.

- **`SUPER_ADMIN`**: Optiq global access. Can create `Clients`, generate API Keys, and assign the first `ADMIN` to a client.
- **`ADMIN`**: Inherits the `clientId` from their user record. Can manage `Tournaments` strictly where `tournament.clientId === user.clientId`. They can also manage global `Teams`, `Players`, and add players to teams.
- **`STATISTICIAN`**: Can handle multiple tournaments assigned to them. They can write to matches by either selecting a match from their assigned tournaments or by entering a specific **Match Key**.

---

## 4. Advanced Data Privacy

Clients require the ability to hide certain advanced metrics (e.g., efficiency ratings, complex shot charts) from public view, while basic box scores remain public.

Instead of hiding entire matches, we handle this at the API Serialization level:

- **Internal APIs (Admin Panel):** Return 100% of the data, as Optiq admins/statisticians need full access to record and verify data.
- **External Client APIs & iFrames:** Utilize a Data Transfer Object (DTO) filter. Basic properties (Points, Rebounds, Assists) are always serialized. Advanced properties (Shot coordinates, PER) are stripped out of the response payload unless the requesting API key is flagged with an “Advanced Analytics” scope.

---

## 5. Data Migration Strategy

To seamlessly upgrade the existing single-tenant database without losing data:

1. A migration script will create a default client named **“Optiq Sports Internal”**.
2. All existing `User`, `Tournament`, and `Match` records will have their `clientId` backfilled to point to the new “Optiq Sports Internal” client.
3. `Team` and `Player` records will remain untouched as they are transitioning to be fully global entities.
4. SuperAdmins will retain global access (clientId = null) to continue managing the system.

---

## 6. User Flows

### Flow 1: SuperAdmin Onboarding a New Client

1. Optiq SuperAdmin logs into the Admin Panel.
2. Navigates to “Clients” -> “Create New Client”.
3. Enters client details (e.g., “EuroLeague Basketball”, logo, website).
4. SuperAdmin creates a new user with role `ADMIN` and assigns them to the “EuroLeague Basketball” client.
5. SuperAdmin generates an API Key for the client to use on their website.

### Flow 2: Client Admin Setting up a Tournament

1. The new Client Admin logs in. The backend detects their `clientId`.
2. Admin creates a new `Tournament` (automatically tagged with their `clientId`).
3. Admin manages global `Teams` and `Players`, adding players to teams as necessary, and then assigns these teams to their `Tournament`.
4. If this Admin tries to view or edit tournaments belonging to “Optiq Sports Internal”, the API strictly rejects the request (Tenant Isolation).

### Flow 3: Statistician Scoring a Game

1. Statistician logs into the Optiq mobile/web app.
2. **Accessing the Match:**
    - *Option A:* They enter a **Match Key** to instantly access and start scoring a specific match.
    - *Option B:* They view their assigned tournaments and select an upcoming match to start.
3. They log realtime `GameEvent`s (e.g., 2pt Field Goal).
4. The backend verifies they have valid access (via the match key or assignment) and processes the event.

### Flow 4: End-Users Viewing Live Stats on Client Website

1. The client has embedded Optiq’s generic `<iframe src="<https://widgets.optiqsports.com/live/match-123?apiKey=>..."></iframe>` on their website.
2. The widget connects to Optiq’s WebSocket Server: `wss://api.optiqsports.com/live`.
3. The connection joins `room_match_123`.
4. The WebSocket server verifies the API key belongs to the client who owns `match-123`.
5. As the Statistician logs events (Flow 3), the backend pushes updates to `room_match_123`.
6. The widget instantly updates the scoreboard. Advanced stats are filtered out by the backend before emission, maintaining data privacy.

---

## 7. Development Roadmap

1. **Phase 1: Database & Tenant Foundation**
    - Apply Prisma schema changes (Client creation, globalizing Teams/Players, adding match keys).
    - Run the “Optiq Sports Internal” data migration script.
2. **Phase 2: Security & Isolation**
    - Implement NestJS Guards/Interceptors to automatically scope all internal API queries for Tournaments/Matches by `clientId`.
3. **Phase 3: B2B External APIs**
    - Implement API key generation and management.
    - Build the `/api/v1/client/*` read-only external API module with the Advanced Data Privacy DTO filters.
4. **Phase 4: Real-time & Widgets**
    - Update WebSocket gateways for secure external client subscriptions.
    - Develop the embeddable web widget views (Scoreboard, Boxscore).