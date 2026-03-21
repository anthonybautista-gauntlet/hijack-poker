# Hijack Poker — Technical Assignment

Welcome to the Hijack Poker technical challenge. This repo provides a working serverless infrastructure skeleton that mirrors our production architecture. Your job is to build one of four challenge options on top of it.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose v2)
- [Node.js 22+](https://nodejs.org/) (for running tests and scripts locally)
- Git

## Challenge Options

| Option | Challenge | Stack | Profile |
|--------|-----------|-------|---------|
| **A** | [Rewards System](https://hijack-poker.github.io/tech-assignment/#/challenge-rewards) | React + Serverless API + DynamoDB | `rewards` |
| **B** | [Bomb Pots](https://hijack-poker.github.io/tech-assignment/#/challenge-bomb-pots) | Game Engine Pipeline (SQS → Lambda → EventBridge) | `engine` |
| **C** | [Daily Streaks](https://hijack-poker.github.io/tech-assignment/#/challenge-streaks) | React + Serverless API + DynamoDB | `streaks` |
| **D** | [Unity Game Client](https://hijack-poker.github.io/tech-assignment/#/challenge-unity-client) | Unity + C# + REST API | `engine` |

Full challenge documentation: **https://hijack-poker.github.io/tech-assignment/**

---

## Quick Start

### 1. Clone & configure

```bash
git clone <this-repo>
cd tech-assignment
cp .env.example .env
```

### 2. Start your challenge profile

Each challenge option has a Docker Compose profile that starts only the services you need. All profiles include the `core` infrastructure (MySQL, Redis, DynamoDB Local).

```bash
# Option A: Rewards System
docker compose --profile rewards up

# Option B: Bomb Pots (Engine Pipeline)
docker compose --profile engine up

# Option C: Daily Streaks
docker compose --profile streaks up
```

> First run takes 2–3 minutes as containers install npm dependencies. Subsequent starts are faster.

### 3. Verify it's running

**Option A — Rewards:**

| Service | URL |
|---------|-----|
| Rewards API health | http://localhost:5000/api/v1/health |
| Rewards Frontend | http://localhost:4000 |

**Option B — Engine Pipeline:**

| Service | URL |
|---------|-----|
| Holdem Processor health | http://localhost:3030/health |
| Cash Game Broadcast health | http://localhost:3032/health |
| Hand Viewer UI | http://localhost:8080 |

**Option C — Streaks:**

| Service | URL |
|---------|-----|
| Streaks API health | http://localhost:5001/api/v1/health |
| Streaks Frontend | http://localhost:4001 |

**Option D — Unity Game Client:**

| Service | URL |
|---------|-----|
| Holdem Processor health | http://localhost:3030/health |
| Table state | http://localhost:3030/table/1 |

> Option D uses the same `engine` Docker profile as Option B. The Unity app runs natively in the Unity Editor (not in Docker) and connects to the holdem-processor API. See `unity-client/README.md` for Unity project setup.

### 4. Stop everything

```bash
docker compose --profile <your-profile> down

# To also remove database volumes (full reset):
docker compose --profile <your-profile> down -v
```

---

## Rewards System (Option A) — Implementation

### What Was Built

A loyalty rewards system where players earn points from gameplay, progress through tiers (Bronze, Silver, Gold, Platinum), and view their status on a web dashboard. This implements **Option A** of the technical challenge.

**Core features:**
- Points engine with stake-based calculation and tier multipliers
- Tier progression with immediate upgrades and protected monthly resets
- Polished React dashboard with tier summary, points history, leaderboard, and tier timeline chart
- Admin endpoints for point adjustments, tier overrides, and monthly resets
- Lean REST endpoints for Unity mobile client consumption
- Idempotent point awards via `handId` GSI with DynamoDB condition expressions
- Player notifications with auto-expiry (DynamoDB TTL)

### Setup

```bash
# 1. Start the rewards profile (includes MySQL, Redis, DynamoDB Local, API, Frontend)
docker compose --profile rewards up

# 2. Seed the rewards tables with demo data (6 players, transactions, leaderboard, etc.)
npm run seed:rewards

# 3. Open the dashboard
# Frontend: http://localhost:4000
# API:      http://localhost:5000/api/v1/health
```

### API Endpoints

#### Player Endpoints (auth: `X-Player-Id` header)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/player/rewards` | Get player rewards summary (tier, points, progress) |
| `GET` | `/api/v1/player/rewards/history` | Get paginated points transaction history |
| `GET` | `/api/v1/player/notifications` | Get player notifications (filterable by unread) |
| `PATCH` | `/api/v1/player/notifications/:id/dismiss` | Dismiss a notification |

#### Points Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/points/award` | Award points for a hand (idempotent via handId) |
| `GET` | `/api/v1/leaderboard` | Get monthly leaderboard (top N, optional player rank) |

#### Admin Endpoints (auth: `X-Admin-Key` header)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/players/:playerId/rewards` | Get full player rewards profile |
| `POST` | `/admin/points/adjust` | Manually adjust player points (positive or negative) |
| `GET` | `/admin/leaderboard` | Admin leaderboard view |
| `POST` | `/admin/tier/override` | Override a player's tier with reason |
| `POST` | `/admin/monthly-reset` | Reset all players' monthly points and recalculate tiers |

### Architecture

The rewards system adds an Express API layer and React frontend on top of the existing infrastructure. Player data is stored in DynamoDB Local (5 tables), with display names denormalized from the existing MySQL `players` table at write time.

**Key architectural decisions:**
- **DynamoDB table-per-access-pattern**: Separate tables for players, transactions, leaderboard, tier history, and notifications. Each table is optimized for its primary query pattern.
- **Immutable ledger**: Transactions are append-only. Points are never modified after being written — adjustments are new entries.
- **Idempotency**: The `handId-index` GSI on `rewards-transactions` prevents duplicate point awards. Uses DynamoDB conditional writes.
- **Atomic updates**: Player point totals use DynamoDB `ADD` operations (not read-then-write) to prevent lost updates.
- **Tier floor protection**: Players can only drop one tier per monthly reset (`newTier = max(currentTier - 1, 1)`).
- **Auto-provisioning**: Players are automatically created in the rewards system on their first point award.

### What's Implemented vs Deferred

| Feature | Status |
|---------|--------|
| Points engine (stake brackets + tier multipliers) | Implemented |
| Tier progression (immediate upgrade, monthly reset) | Implemented |
| Immutable transaction ledger | Implemented |
| handId idempotency (GSI + conditional write) | Implemented |
| Leaderboard (monthly, sorted by points) | Implemented |
| Tier history (6-month timeline) | Implemented |
| Notifications (tier changes, milestones, TTL) | Implemented |
| Admin endpoints (adjust, override, reset) | Implemented |
| React dashboard (summary, history, leaderboard, timeline) | Implemented |
| RTK Query integration | Implemented |
| Player auth | Stub (`X-Player-Id` header, no token verification) |
| Admin auth | Stub (`X-Admin-Key` header matching env var) |
| Automated monthly reset (cron) | Deferred — manual endpoint only |
| Cursor-based pagination | Deferred — uses in-memory offset/limit |

### Running Tests

```bash
# Backend unit tests (from project root)
npm --prefix serverless-v2/services/rewards-api test

# Frontend component tests
npm --prefix serverless-v2/services/rewards-frontend test
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Docker Compose Profiles                                         │
│                                                                  │
│  core:    MySQL 8.0 │ Redis 7 │ DynamoDB Local                   │
│                                                                  │
│  engine:  core + ElasticMQ (SQS) + EventBridge Mock              │
│           + Holdem Processor (:3030) + Broadcast (:3032)         │
│           + Hand Viewer (:8080)                                  │
│                                                                  │
│  rewards: core + Rewards API (:5000) + React Frontend (:4000)    │
│                                                                  │
│  streaks: core + Streaks API (:5001) + React Frontend (:4001)    │
└──────────────────────────────────────────────────────────────────┘
```

### Engine Pipeline (Option B)

```
                  ┌──────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐
HTTP POST ──────► │ ElasticMQ│───►│ Holdem Processor │───►│ EventBridge Mock│───►│ Cash Game     │
/process          │  (SQS)   │    │   (Lambda)       │    │                 │    │ Broadcast     │
                  └──────────┘    └────────┬─────────┘    └─────────────────┘    └───────────────┘
                                           │
                                      ┌────▼────┐
                                      │  MySQL  │
                                      │ (state) │
                                      └─────────┘
```

The holdem processor runs a **16-step state machine** for each poker hand:

```
GAME_PREP → SETUP_DEALER → SETUP_SMALL_BLIND → SETUP_BIG_BLIND → DEAL_CARDS
→ PRE_FLOP_BETTING_ROUND → DEAL_FLOP → FLOP_BETTING_ROUND → DEAL_TURN
→ TURN_BETTING_ROUND → DEAL_RIVER → RIVER_BETTING_ROUND
→ AFTER_RIVER_BETTING_ROUND → FIND_WINNERS → PAY_WINNERS
→ RECORD_STATS_AND_NEW_HAND
```

Each call to `processTable(tableId)` advances the hand by **one step**. After the final step, the next call starts a new hand automatically.

### API + Frontend (Options A & C)

```
React Frontend (Vite) → Serverless API (serverless-offline) → DynamoDB Local
```

---

## Hand Viewer UI (Option B)

A simple vanilla JS poker table UI is included for visualizing the hand processing pipeline.

### Running the Hand Viewer

The Hand Viewer is served automatically when running the `engine` profile:

```bash
docker compose --profile engine up -d
```

Then open http://localhost:8080.

### What it shows

- Green felt poker table with 6 player seats
- Community cards dealt to the center (flop, turn, river)
- Player stacks, bets, and actions at each seat
- Dealer / SB / BB position badges
- Cards face-down during play, revealed at showdown
- Winner highlighting with hand rank and payout
- Step-by-step log of the hand processing

### Controls

| Button | Action |
|--------|--------|
| **Next Step** | Advance one state machine step |
| **Auto Play** | Automatically cycle through steps |
| **Speed** (1s/0.5s/0.25s/2s) | Auto-play interval |
| **Reset** | Refresh table state |

---

## Project Structure

```
tech-assignment/
├── docker-compose.yml              # All services with profiles
├── .env.example                    # Environment variable defaults
├── infrastructure/
│   ├── elasticmq.conf              # SQS queue definitions
│   └── mysql-init/
│       └── 01-schema.sql           # Database schema + seed data
├── scripts/
│   ├── init-dynamodb.sh            # Create DynamoDB tables
│   ├── seed-rewards.js             # Seed rewards data (Option A)
│   ├── seed-streaks.js             # Seed streaks data (Option C)
│   └── simulate-hands.js           # Send SQS messages (Option B)
├── ui/
│   └── index.html                  # Poker hand viewer (Option B)
├── serverless-v2/
│   ├── shared/                     # Shared code across all services
│   │   ├── config/                 # db.js, redis.js, dynamo.js, logger.js
│   │   ├── utils/                  # Common helpers (toMoney, etc.)
│   │   └── games/common/           # Poker logic
│   │       ├── constants.js        # GAME_HAND (0–16), PLAYER_STATUS, ACTION
│   │       ├── cards.js            # Deck, shuffle, deal, hand evaluation
│   │       ├── betting.js          # Bet processing
│   │       ├── players.js          # Seat/player management
│   │       └── pots.js             # Main/side pot calculation
│   └── services/
│       ├── holdem-processor/       # Option B: Hand processing Lambda
│       ├── cash-game-broadcast/    # Option B: EventBridge → WebSocket
│       ├── rewards-api/            # Option A: Rewards backend
│       ├── rewards-frontend/       # Option A: React dashboard (Vite)
│       ├── streaks-api/            # Option C: Streaks backend
│       └── streaks-frontend/       # Option C: React UI (Vite)
```

### Shared Code

All services mount `serverless-v2/shared/` for access to common config and game logic. In Docker, it's mounted at `/app/shared`. Locally, each service has a symlink: `shared -> ../../shared`.

---

## Running Tests

```bash
# Holdem processor (15 tests)
cd serverless-v2/services/holdem-processor && npm install && npm test

# Rewards API (1 test)
cd serverless-v2/services/rewards-api && npm install && npm test

# Streaks API (1 test)
cd serverless-v2/services/streaks-api && npm install && npm test
```

---

## Useful Commands

```bash
# Check which containers are running
docker compose ps

# View logs for a specific service
docker compose logs holdem-processor --tail 50 -f

# Restart a single service (picks up code changes)
docker compose restart holdem-processor

# Process one hand step manually (Option B)
curl -X POST http://localhost:3030/process \
  -H 'Content-Type: application/json' \
  -d '{"tableId": 1}'

# Read current table state (Option B)
curl http://localhost:3030/table/1

# Connect to MySQL
docker compose exec mysql mysql -uhijack -phijack_dev hijack_poker

# Reset game state (Option B)
docker compose exec mysql mysql -uhijack -phijack_dev hijack_poker \
  -e "DELETE FROM game_players; DELETE FROM games;"
```

---

## Database

### MySQL Schema (Options A & B)

The `infrastructure/mysql-init/01-schema.sql` file creates tables and seed data on first run:

| Table | Purpose |
|-------|---------|
| `players` | 6 seeded players (Alice, Bob, Charlie, Diana, Eve, Frank) |
| `game_tables` | 2 poker tables (Starter Table 1/2 blinds, High Stakes 5/10) |
| `games` | Hand state: step, dealer, blinds, community cards, deck, pot, winners |
| `game_players` | Per-hand player state: seat, stack, cards, bets, action, winnings |
| `game_stats` | Aggregate stats per player per table |
| `ledger` | Financial transactions |

### DynamoDB Tables (Options A & C)

Created by `scripts/init-dynamodb.sh` (also run by the `dynamodb-init` container on startup):

- `rewards-players` — Player tier and points
- `rewards-transactions` — Points transaction history
- `rewards-leaderboard` — Monthly leaderboard
- `rewards-notifications` — Player notifications
- `streaks-players` — Streak state
- `streaks-activity` — Daily check-in records
- `streaks-rewards` — Streak milestone rewards
- `streaks-freeze-history` — Freeze usage history
- `connections` — WebSocket connection tracking (Option B)

---

## Port Reference

| Service | Port | Profile |
|---------|------|---------|
| MySQL | 3306 (or `MYSQL_EXTERNAL_PORT`) | core |
| Redis | 6379 (or `REDIS_EXTERNAL_PORT`) | core |
| DynamoDB Local | 8000 (or `DYNAMODB_EXTERNAL_PORT`) | core |
| ElasticMQ (SQS) | 9324 | engine |
| EventBridge Mock | 4010 | engine |
| Holdem Processor | 3030 | engine |
| Cash Game Broadcast | 3032 | engine |
| Hand Viewer | 8080 (or `HAND_VIEWER_PORT`) | engine |
| Rewards API | 5000 | rewards |
| Rewards Frontend | 4000 | rewards |
| Streaks API | 5001 | streaks |
| Streaks Frontend | 4001 | streaks |

### Port Conflicts

If you have other services running on these ports, edit `.env` to remap the external ports:

```bash
# Example: remap core services to avoid conflicts
MYSQL_EXTERNAL_PORT=3307
REDIS_EXTERNAL_PORT=6380
DYNAMODB_EXTERNAL_PORT=8001
```

---

## Troubleshooting

**Containers take a long time on first start?**
- Normal. Each service container runs `npm install` on first boot. Subsequent restarts are faster because `node_modules` is cached in the container volume.

**MySQL connection refused?**
- MySQL takes ~15 seconds to initialize on first run. Other services wait for its health check before starting. Check status: `docker compose ps`

**Port already in use?**
- Another service is using the port. Remap in `.env` (see [Port Conflicts](#port-conflicts)).

**Lambda timeout errors?**
- Default Lambda timeout is 30 seconds. If you see `[504] Lambda timeout`, your function is likely hanging on an external call. Check EventBridge/MySQL connectivity in the logs.

**Changes not picked up?**
- Service code is volume-mounted, but serverless-offline doesn't hot-reload. Restart the service: `docker compose restart <service-name>`

**Want a completely fresh start?**
```bash
docker compose --profile <your-profile> down -v
docker compose --profile <your-profile> up
```
This removes all database volumes and reinitializes from scratch.

**Tests fail with "Cannot find module"?**
- Run `npm install` in the service directory first. Docker installs deps inside the container, but local test runs need local `node_modules`.
