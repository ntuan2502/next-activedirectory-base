# Active Directory Sync

🌐 [Tiếng Việt (Vietnamese)](README.vi.md) | **English**

A Dashboard application built on the Next.js framework that synchronizes and manages user data from Active Directory / LDAP with a PostgreSQL database. It integrates multi-source authentication and fine-grained Role-Based Access Control (RBAC).

---

## ✨ Key Features

- **Initial Setup Wizard (`/setup`)** — Automatically redirects and guides you through initializing the first local Super Admin account and configuring LDAP connections when the application runs on an empty database.
- **Dynamic LDAP Configuration** — Stores LDAP configurations directly in the database, allowing flexible updates via the UI without static declarations in `.env` files.
- **Multi-Source Authentication (Local & LDAP)**:
  - **AD/LDAP Account**: Login using corporate credentials verified directly against Active Directory.
  - **Local Account (Local User)**: Bypasses LDAP check, authenticating with hashed `bcryptjs` passwords in the database. This ensures administrators can always log in even when the LDAP server is offline.
- **Automated Sync Scheduler** — Automatically syncs users in the background periodically based on dynamically configured intervals (1h, 6h, 12h, 24h, etc.).
- **Visual Analytics Dashboard**:
  - **Donut Chart**: Shows the distribution of user sync status.
  - **Horizontal Bar Chart**: Shows personnel counts across the top 5 departments.
  - **Smooth Area Chart**: Timeline of activity logs over the last 7 days.
- **Role Management & Permissions (RBAC)** — Define custom roles and control detailed permissions (`users:read`, `roles:update`, `ldap:sync`, etc.).
- **Audit Logs** — Records all system operations, showing detailed before/after comparison logs.
- **Centralized Multilingual Support (i18n)** — Supports 4 languages: **English**, **Vietnamese**, **Thai**, and **Japanese** powered by a highly extensible centralized Locale Registry.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript |
| UI/CSS | Tailwind CSS v4 + Vanilla CSS |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 |
| LDAP Client | ldapts |
| Authentication | bcryptjs + jose (JWT Session Cookie) |
| Multilingual | Custom Client/Server i18n |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (or [Bun](https://bun.sh/)) installed
- [Docker](https://www.docker.com/) installed (to run PostgreSQL)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/ntuan2502/next-activedirectory-base.git
cd next-activedirectory-base
pnpm install
```

### 2. Environment Variables Setup

Copy the sample environment variables file:

```bash
cp .env.example .env
```

Update your database credentials and session secrets in `.env` (no LDAP variables needed here):

```env
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_password
POSTGRES_DB=ad_sync
POSTGRES_PORT=5432

# Connection URL for Prisma
DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/ad_sync?schema=public

# Session Security
SESSION_SECRET=change_me_to_a_random_string_at_least_32_chars
NODE_ENV=development
```

### 3. Run PostgreSQL via Docker

```bash
docker compose up -d
```

### 4. Push Schema to Database

```bash
pnpm prisma db push
```

### 5. Launch Development Server

```bash
pnpm dev
```

Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

> 💡 **First-time Setup**: If the database is empty, the application will automatically redirect you to `/setup` to create your initial Admin account and configure the LDAP connection.

---

## 📂 Project Directory Structure

```plaintext
├── src/
│   ├── app/
│   │   ├── (dashboard)/                # Group routes sharing the Sidebar Layout
│   │   │   ├── audit-logs/             # Audit logs comparison view
│   │   │   ├── roles/                  # Role-Based Access Control management
│   │   │   ├── settings/               # LDAP and Sync scheduling configuration
│   │   │   ├── users/                  # Synced users management
│   │   │   └── page.tsx                # Interactive charts dashboard
│   │   ├── login/                      # Login portal
│   │   ├── setup/                      # Setup Wizard (System initialization)
│   │   ├── api/                        # API routes
│   │   │   ├── setup/                  # Setup Wizard APIs
│   │   │   ├── auth/                   # Authentication & Session APIs
│   │   │   ├── settings/               # LDAP & system configuration APIs
│   │   │   └── ...
│   │   └── layout.tsx                  # Root layout
│   ├── components/                     # Reusable UI components
│   ├── config/
│   │   ├── locales/                    # i18n translation bundles: en.ts, vi.ts, th.ts, ja.ts
│   │   │   ├── index.ts                # Centralized Locale Registry
│   │   │   └── ...
│   │   └── permissions.ts              # System permission definitions
│   ├── lib/
│   │   ├── auth.ts                     # Local & LDAP authentication logic
│   │   ├── ldap.ts                     # LDAP client & DB config integration
│   │   ├── scheduler.ts                # Background synchronization cron job
│   │   └── sync-core.ts                # Unified core user sync logic
```

---

## 🔒 Authentication Flow

```plaintext
                   User submits login request
                               │
                               ▼
                   Lookup user in local database
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
            User found                 User not found
                 │                           │
       ┌─────────┴─────────┐                 ▼
       ▼                   ▼          Perform LDAP Bind
   dn === "" (Local)   dn !== ""   (Verify against corporate AD)
       │              (AD User)              │
       ▼                   │                 ▼
Compare password           │          ┌──────┴──────┐
  using bcrypt             ▼          ▼             ▼
       │            Attempt LDAP Bind   Success       Failure
       │               connection            │             │
       │                   │                 ▼             ▼
       │            ┌──────┴──────┐      Sync User        Error
       ▼            ▼             ▼   & Create Session
Compare result   Success       Failure
       │            │             │
       ▼            ▼             ▼
Create Session  Create Session  Error
```

---

## ⚡ Real-Time Sync via Server-Sent Events (SSE)

The application uses **Server-Sent Events (SSE)** for one-way, real-time event streaming from the server to client to synchronize system state:
- **Display Configurations**: Changing visual settings (theme, language, font size, etc.) on one device immediately syncs across all other active sessions of the same account.
- **Permissions**: Updating a user's roles or permissions refreshes their client-side access levels instantly without reloading the page.
- **Session Revocation (Kicked Overlay)**: When an active session is revoked remotely, the client immediately locks with a "Session Terminated" overlay (similar to multiplayer game lockouts) and redirects to the login screen.

### 📐 Architecture Design & Scaling Guide

The project currently uses **Option A** for single-instance setups, and is designed to easily scale out to **Option B** for clustered deployments.

#### Option A: In-Memory Global EventEmitter (Current)
- **Mechanism**: A global Node.js `EventEmitter` (`SseManager`) routes events between API routes and active client HTTP connections.
- **Pros**:
  - Requires no third-party infrastructure.
  - Zero latency on a single-node deployment.
  - Utilizes a global reference registry (`globalRef`) to prevent losing event handles during Hot Module Replacement (HMR) in development.
- **Cons**: Does not support horizontal scaling across multiple servers since memory states are isolated.

#### Option B: Scaled-Out Message Broker (Redis Pub/Sub or PostgreSQL LISTEN/NOTIFY)
When deploying the app in a load-balanced cluster (Kubernetes / Multi-Server), use a messaging broker to share events:

1. **PostgreSQL `LISTEN/NOTIFY` (Recommended to avoid Redis overhead)**:
   - **How it works**:
     - On state change, write:
       ```sql
       NOTIFY sse_channel, '{"userId": "123", "type": "SETTINGS_UPDATED", "payload": {...}}';
       ```
     - In the `/api/auth/sse` route, maintain a dedicated PostgreSQL client executing `LISTEN sse_channel` and forward incoming `pg.on('notification')` events directly to the client's HTTP stream.
   - **Pros**: Leverages the existing PostgreSQL database without adding extra services.

2. **Redis Pub/Sub (Best for massive load)**:
   - **How it works**:
     - Connect via Redis clients (e.g., `ioredis`).
     - Publish events using `redisPublishClient.publish("user:sse:channel", JSON.stringify(event))`.
     - In `/api/auth/sse`, subscribe using `redisSubscribeClient.subscribe("user:sse:channel")` and pipe payload strings into client connections.
   - **Pros**: Extremely low latency, sub-millisecond response, scales to millions of concurrent sessions easily.

---

## 📝 Common Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the local development server |
| `pnpm build` | Compile the Next.js production build |
| `pnpm start` | Run the compiled production build |
| `pnpm lint` | Analyze code quality and styling (ESLint) |
| `pnpm prisma db push` | Push Prisma schema changes directly to the database |
| `pnpm prisma studio` | Launch a visual browser GUI to manage database records |

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
