# Active Directory Sync

A Next.js dashboard for synchronizing and managing user data from LDAP/Active Directory, with PostgreSQL persistence and LDAP-based authentication.

## Features

- **LDAP Connection Test** — Verify connectivity to your AD server
- **User Sync** — Pull users from Active Directory and persist to PostgreSQL
- **LDAP Authentication** — Login with corporate AD credentials
- **Offline Auth Fallback** — Cached password hashes (bcrypt) allow login when LDAP is unreachable
- **Session Management** — Signed JWT cookies (httpOnly, 8h expiry)
- **Admin Dashboard** — View all synced users in a searchable table

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 (driver adapter) |
| LDAP Client | ldapts |
| Auth | bcryptjs + jose (JWT) |
| Runtime | Bun |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- [Docker](https://www.docker.com/) installed (for PostgreSQL)
- Access to an LDAP/Active Directory server

### 1. Clone and install

```bash
git clone https://github.com/ntuan2502/next-activedirectory-base.git
cd next-activedirectory-base
bun install
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Key variables:

```env
# Required — LDAP
LDAP_URL=ldap://your-ad-server
LDAP_PORT=389
LDAP_USERNAME=admin@yourdomain.com
LDAP_PASSWORD=your_password

# Optional — LDAP (has fallback defaults)
LDAP_BASE_DN=DC=yourdomain,DC=com
LDAP_FILTER=(&(objectCategory=person)(objectClass=user))

# Required — Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=activedirectory
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/activedirectory

# Required — Session
SESSION_SECRET=change-me-to-a-random-string-at-least-32-chars
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

Adminer is available at [http://localhost:8080](http://localhost:8080).

### 4. Initialize database

```bash
bunx prisma db push
```

### 5. Run development server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to the login page.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts      # POST — LDAP auth + session
│   │   │   ├── logout/route.ts     # POST — clear session
│   │   │   └── session/route.ts    # GET  — check session
│   │   └── ldap/
│   │       ├── sync/route.ts       # POST — sync LDAP → DB
│   │       └── test/route.ts       # POST — test connection
│   ├── login/page.tsx              # Login form
│   ├── page.tsx                    # Dashboard (protected)
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Tailwind + shadcn theme
├── components/ui/                  # shadcn components
├── lib/
│   ├── auth.ts                     # LDAP auth + bcrypt fallback
│   ├── db.ts                       # Prisma client singleton
│   ├── ldap.ts                     # LDAP config + utilities
│   ├── session.ts                  # JWT session management
│   └── utils.ts                    # shadcn cn() utility
├── prisma/
│   └── schema.prisma               # Database schema
├── docker-compose.yml              # PostgreSQL + Adminer
├── .env.example                    # Environment template
└── prisma.config.ts                # Prisma CLI config
```

## Authentication Flow

```
User submits login form
        │
        ▼
  Try LDAP bind with user credentials
        │
   ┌────┴────┐
   │ Success  │  LDAP Error (connection)
   │         │         │
   ▼         │         ▼
Hash password│   Find user in DB
Store in DB  │   Compare bcrypt hash
   │         │         │
   ▼         │    ┌────┴────┐
Create JWT   │    │ Match   │ No match
session      │    │         │
   │         │    ▼         ▼
   ▼         │  Login OK   Error
 Login OK    │
             │
   LDAP Error (bad credentials)
             │
             ▼
          Error: Invalid credentials
```

## Scripts

| Command | Description |
|---|---|
| `bun dev` | Start development server |
| `bun run build` | Production build |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bunx prisma db push` | Push schema to database |
| `bunx prisma studio` | Open Prisma Studio GUI |
| `docker compose up -d` | Start PostgreSQL + Adminer |
| `docker compose down` | Stop containers |

## License

MIT
