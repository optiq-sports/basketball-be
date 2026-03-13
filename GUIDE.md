## Basketball Management API – Frontend Integration Guide

This guide explains how your frontend should talk to the backend: auth, headers, roles, base URLs, and all key endpoints.

---

## 1. Environment & Base URL

- **Base URL (dev)**: `http://localhost:3000/api`
- **Postman collection**: `postman/Basketball_Management_API.postman_collection.json`
  - Import this into Postman to see examples for every endpoint.

If you deploy the backend, expose the same `/api` prefix (e.g. `https://api.myapp.com/api`) and update the frontend/env accordingly.

---

## 2. Authentication & Roles

### 2.1 Auth model

- **Auth type**: JWT Bearer token.
- **Login flow**:
  1. Call `POST /auth/login` with email/password.
  2. Backend returns an `access_token`.
  3. For all protected endpoints, send:
     - **Header**: `Authorization: Bearer <access_token>`.

### 2.2 Roles

Roles come from Prisma’s `Role` enum:

- **SUPER_ADMIN**
- **ADMIN**
- **STATISTICIAN**

Role restrictions are enforced server‑side. The frontend should:

- Read the user’s role from the auth response / profile.
- Hide or disable UI for actions the user cannot perform (e.g. admin screens for non‑admins).

---

## 3. Auth Endpoints

### 3.1 Register

- **Method**: `POST`
- **URL**: `/auth/register`
- **Body (JSON)**:

```json
{
  "email": "admin@example.com",
  "password": "password123",
  "role": "ADMIN"
}
```

- **Typical usage**: Only for bootstrapping or managed by a super admin. Returns an object containing `access_token` and user info.

### 3.2 Login

- **Method**: `POST`
- **URL**: `/auth/login`
- **Body (JSON)**:

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

- **Response**:
  - Contains `data.access_token` (JWT) and user info.
- **Frontend**:
  - Store `access_token` in memory (or secure storage).
  - Add `Authorization: Bearer <token>` to all subsequent protected requests.

### 3.3 Get Profile

- **Method**: `GET`
- **URL**: `/auth/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Usage**:
  - Called after login or on app load to get the current user and role.

---

## 4. Players

Base path: `/players` (JWT required for all).

### 4.1 Create Standalone Player

- **Method**: `POST`
- **URL**: `/players`
- **Roles**: `ADMIN`, `STATISTICIAN`
- **Body (JSON)** (example):

```json
{
  "firstName": "LeBron",
  "lastName": "James",
  "email": "lebron@example.com",
  "position": "SMALL_FORWARD",
  "height": "6'9\"",
  "phone": "+1234567890",
  "dateOfBirth": "1984-12-30",
  "nationality": "USA",
  "confirmDuplicate": false
}
```

**Deduplication behavior**:

- Exact match (first name, last name, DOB) → error.
- Fuzzy match (~75% similarity) → backend may return a duplicate warning.
- If you want to **force create** despite a warning, set `confirmDuplicate: true` and resend.

### 4.2 Create Player for Team

- **Method**: `POST`
- **URL**: `/players/team`
- **Roles**: `ADMIN`, `STATISTICIAN`
- **Body (JSON)**:

```json
{
  "teamId": "<team_id>",
  "firstName": "Kobe",
  "lastName": "Bryant",
  "jerseyNumber": 24,
  "email": "kobe@example.com",
  "position": "SHOOTING_GUARD",
  "height": "6'6\"",
  "dateOfBirth": "1978-08-23",
  "nationality": "USA",
  "confirmDuplicate": false
}
```

### 4.3 Bulk Create Players for Team

- **Method**: `POST`
- **URL**: `/players/team/bulk`
- **Roles**: `ADMIN`, `STATISTICIAN`
- **Body (JSON)**:

```json
{
  "teamId": "<team_id>",
  "players": [
    {
      "firstName": "Stephen",
      "lastName": "Curry",
      "jerseyNumber": 30,
      "email": "steph@example.com",
      "position": "POINT_GUARD",
      "height": "6'3\"",
      "nationality": "USA"
    }
  ]
}
```

### 4.4 Upload Players via Excel

- **Method**: `POST`
- **URL**: `/players/team/:teamId/upload`
- **Roles**: `ADMIN`, `STATISTICIAN`
- **Body**: `multipart/form-data`
  - Field `file`: `.xlsx` file with player data.

Frontend should use a file upload component that posts `FormData` to this URL.

### 4.5 List / Get / Update / Delete Players

- **List players**
  - **GET** `/players`
  - Optional query:
    - `teamId=<team_id>` – filter by team.
    - `unassigned=true` – players without a team.

- **Get by ID**
  - **GET** `/players/:id`

- **Update**
  - **PATCH** `/players/:id`
  - Roles: `ADMIN`, `STATISTICIAN`
  - Body: subset of fields like `height`, `position`, etc.

- **Delete**
  - **DELETE** `/players/:id`
  - Role: `ADMIN`
  - Effect: deactivates associations but keeps stats history.

### 4.6 Assign / Remove Player from Team

- **Assign**
  - **PUT** `/players/:id/teams/:teamId`
  - Roles: `ADMIN`, `STATISTICIAN`
  - Body (JSON):

```json
{
  "jerseyNumber": 8
}
```

- **Remove**
  - **DELETE** `/players/:id/teams/:teamId`
  - Roles: `ADMIN`, `STATISTICIAN`

### 4.7 Merge Player Profiles

- **Method**: `POST`
- **URL**: `/players/merge`
- **Role**: `ADMIN`
- **Body (JSON)**:

```json
{
  "duplicatePlayerId": "<id_to_be_deleted>",
  "targetPlayerId": "<id_to_be_kept>"
}
```

Use this when deduping players in the UI.

---

## 5. Teams

Base path: `/teams` (JWT required).

### 5.1 Create Team

- **POST** `/teams`
- Roles: `ADMIN`, `STATISTICIAN`
- Example body:

```json
{
  "name": "Los Angeles Lakers",
  "code": "LAL",
  "color": "#552583",
  "country": "USA",
  "state": "California",
  "coach": "Darvin Ham",
  "assistantCoach": "Phil Handy"
}
```

### 5.2 List / Get / Update / Delete Team

- **List**
  - **GET** `/teams`
  - Optional query: `tournamentId=<tournament_id>` to filter teams in a tournament.

- **Get**
  - **GET** `/teams/:id`

- **Update**
  - **PATCH** `/teams/:id`
  - Roles: `ADMIN`, `STATISTICIAN`

- **Delete**
  - **DELETE** `/teams/:id`
  - Role: `ADMIN`

### 5.3 Set Team Captain

- **Method**: `PATCH`
- **URL**: `/teams/:id/players/:playerId/captain`
- **Roles**: `ADMIN`, `STATISTICIAN`
- **Body (JSON)**:

```json
{
  "isCaptain": true
}
```

Setting this automatically unsets any previous captain for that team.

---

## 6. Tournaments

Base path: `/tournaments` (JWT required for management; some read endpoints may be public in the future).

### 6.1 Create Tournament

- **POST** `/tournaments`
- Roles: `ADMIN`, `STATISTICIAN`
- Example body (see Postman for full shape):

```json
{
  "name": "City Championship 2025",
  "division": "PREMIER",
  "numberOfGames": 14,
  "numberOfQuarters": 4,
  "quarterDuration": 10,
  "overtimeDuration": 5,
  "startDate": "2025-01-15T09:00:00Z",
  "endDate": "2025-01-20T18:00:00Z",
  "venue": "Main Arena",
  "crewChief": "John Referee",
  "umpire1": "Jane Umpire",
  "umpire2": "Bob Umpire",
  "commissioner": "Commissioner Smith"
}
```

### 6.2 List / Get / Get by Code / Update / Delete

- **List all**: `GET /tournaments`
- **Get by ID**: `GET /tournaments/:id`
- **Get by code**: `GET /tournaments/code/:code`
- **Update**:
  - `PATCH /tournaments/:id`
  - Roles: `ADMIN`, `STATISTICIAN`
- **Delete**:
  - `DELETE /tournaments/:id`
  - Role: `ADMIN`

### 6.3 Add / Remove Teams in Tournament

- **Add teams**
  - **POST** `/tournaments/:id/teams`
  - Roles: `ADMIN`, `STATISTICIAN`
  - Body:

```json
{
  "teamIds": ["<team_id_1>", "<team_id_2>"]
}
```

- **Remove team**
  - **DELETE** `/tournaments/:id/teams/:teamId`
  - Role: `ADMIN`

### 6.4 Upload Tournament Flyer

- **Method**: `PATCH`
- **URL**: `/tournaments/:id/flyer`
- **Roles**: `ADMIN`, `STATISTICIAN`
- **Body**: `multipart/form-data`
  - Field `flyer`: image file.

Backend uploads to storage (via provider) and stores the flyer URL.

---

## 7. Matches

Base path: `/matches` (JWT required).

### 7.1 Create Match

- **POST** `/matches`
- Roles: `ADMIN`, `STATISTICIAN`
- Example body:

```json
{
  "tournamentId": "<tournament_id>",
  "homeTeamId": "<team_id_home>",
  "awayTeamId": "<team_id_away>",
  "scheduledDate": "2025-01-16T10:00:00Z",
  "status": "SCHEDULED",
  "venue": "Main Court"
}
```

Both teams must belong to the tournament.

### 7.2 List / Get Match

- **List**:
  - `GET /matches`
  - Optional query:
    - `tournamentId=<tournament_id>`
    - `status=SCHEDULED|LIVE|COMPLETED|CANCELLED|POSTPONED`
- **Get by ID**:
  - `GET /matches/:id`

### 7.3 Update Match (Scores & Status)

- **Update scores (and status)**:
  - `PATCH /matches/:id`
  - Roles: `ADMIN`, `STATISTICIAN`
  - Body example:

```json
{
  "quarter1Home": 25,
  "quarter1Away": 20,
  "quarter2Home": 22,
  "quarter2Away": 24,
  "quarter3Home": 28,
  "quarter3Away": 25,
  "quarter4Home": 30,
  "quarter4Away": 28,
  "status": "COMPLETED"
}
```

- **Update status only**:
  - `PATCH /matches/:id`
  - Body example:

```json
{
  "status": "LIVE"
}
```

### 7.4 Delete Match

- **DELETE** `/matches/:id`
- Role: `ADMIN`

---

## 8. Admin Management

Base path: `/admin` (JWT + `SUPER_ADMIN` role required for all).

- **Create admin**
  - `POST /admin`
  - Body: email/password + profile fields.
- **List admins**
  - `GET /admin`
- **Get admin**
  - `GET /admin/:id`
- **Update admin**
  - `PATCH /admin/:id`
- **Delete admin**
  - `DELETE /admin/:id`

Frontend should show this section only to super admins.

---

## 9. Statistician Management

Base path: `/statistician` (JWT + `SUPER_ADMIN` or `ADMIN`).

- **Create statistician**
  - `POST /statistician`
- **List statisticians**
  - `GET /statistician`
- **Get by ID**
  - `GET /statistician/:id`
- **Update**
  - `PATCH /statistician/:id`
- **Upload photo**
  - `PATCH /statistician/:id/photo`
  - Body: `multipart/form-data` with `photo` file field.
- **Delete**
  - `DELETE /statistician/:id`

Use this module to manage users responsible for entering stats.

---

## 10. Generic File Upload

Base path: `/upload`.

- **Upload file**
  - **POST** `/upload`
  - Body: `multipart/form-data`
    - Field `file`: file to upload.
  - Response: object with `url` pointing to the stored file.

This is a low-level utility endpoint – in most UIs you’ll use the more specific upload endpoints (`/tournaments/:id/flyer`, `/statistician/:id/photo`, `/players/team/:teamId/upload`).

---

## 11. Frontend Implementation Notes

- **HTTP client**: use a central wrapper (e.g. Axios instance) that:
  - Adds `Authorization: Bearer <token>` automatically if a token is present.
  - Handles 401/403 globally (redirect to login / show “not authorized”).
- **Date handling**:
  - All dates are ISO‑8601 strings (`YYYY-MM-DDTHH:mm:ssZ`).
  - Use a date library on the frontend to format for display.
- **Enums**:
  - Status & roles are string enums (`"ADMIN"`, `"SUPER_ADMIN"`, `"SCHEDULED"`, `"LIVE"`, etc.).
  - Prefer using TypeScript string unions mapping to these exact values.

Use the Postman collection as the source of truth for sample requests/responses while this guide stays as your high‑level reference for wiring up the UI.

