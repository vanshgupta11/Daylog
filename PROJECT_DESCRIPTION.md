# Daylog — Full-Stack Habit & Skill Intelligence Platform

> A modern, data-dense habit tracker and personal growth operating system combining GitHub-style activity heatmaps, an Obsidian-inspired interactive knowledge graph, and a secure cloud-synced backend.

---

## 1. Executive Summary

**Daylog** is a personal tracking application engineered for individuals who want deep visibility into their daily habits, routines, and skill acquisition. Inspired by modern developer tools (Vercel, GitHub, and Obsidian), Daylog treats habit formation not as isolated checkboxes, but as an interconnected ecosystem of behaviors.

By pairing per-habit GitHub-style contribution heatmaps with a force-directed canvas graph, Daylog bridges the gap between daily quantitative logging and high-level behavioral architecture. With full-stack user authentication and cloud synchronization, users can seamlessly transition across devices while keeping their growth metrics persistent and secure.

---

## 2. Key Features & Highlights

### 📊 Per-Habit GitHub-Style Heatmaps
- **Multi-Year History**: Visualizes up to 2 years (730 days) of granular daily consistency.
- **Dynamic Intensity Levels**: 5-tier intensity color scales calculated dynamically against target goals.
- **Quantitative & Boolean Tracking**: Supports binary completions (Done/Not Done) or custom numerical targets (e.g., 8,000 steps, 45 minutes of deep work, 2 DSA problems).
- **Interactive Day Inspector**: Hover or tap any cell to view the exact date, numerical logged value, and target progress.

### 🕸️ Interactive Force-Directed Habit Graph
- **Obsidian-Style Visualization**: Renders habits and parent categories as nodes in an interactive physics simulation powered by HTML5 Canvas.
- **Dependency & Synergy Links**: Connect related habits (e.g., *Meditation* linked with *Sleep Quality*, or *Reading* linked with *Writing*).
- **Dynamic Physics Engine**: Real-time velocity damping, node repulsion, collision detection, smooth panning, and exponential mouse-wheel zoom.
- **Focus Modes**: Click on any node to isolate its connected neighborhood and highlight behavioral synergy.

### 🎯 Skill Trees & Hierarchical Grouping
- **Parent-Child Categorization**: Organize granular habits into macro-domains (e.g., `Mind` → `Read`, `Meditate`; `Craft` → `Code` → `DSA`, `Side Project`).
- **Aggregated Progress Rollups**: Parent domains automatically calculate weighted completion ratios from all underlying leaf habits.
- **Collapsible Workspace Tree**: Clean sidebar navigation with collapsible hierarchies.

### ⏱️ Streak Engine & Challenge Mode
- **Real-Time Analytics**: Calculates current streak, all-time best streak, 30-day consistency score, and cumulative lifetime completions.
- **Challenge Countdown**: Built-in 30-day challenge sprints with remaining day counters and restart capabilities.

### 🔐 User Authentication & Account Isolation
- **Secure Registration & Login**: Dedicated authentication portal built in React with form validation and responsive layout.
- **Bcrypt Password Security**: Passwords are salted and hashed with `bcryptjs` before persistence.
- **Stateless JWT Sessions**: Session management utilizing 30-day signed JSON Web Tokens transmitted exclusively via secure, `httpOnly`, `sameSite: lax` cookies.
- **Multi-User Data Isolation**: Habits, logs, and graph layouts are strictly scoped to unique MongoDB user IDs.

### 🔄 Dual-Layer Persistence (Offline + Cloud Sync)
- **Zero-Latency Local Cache**: Instant local reads and optimistic UI updates via user-scoped `localStorage`.
- **Debounced Cloud Sync**: Changes are automatically batched and synchronized to MongoDB with a 700ms debounce buffer to eliminate redundant network traffic.
- **Conflict Resolution**: Timestamp-driven synchronization ensures the latest state is reliably preserved across multi-tab or multi-device sessions.

---

## 3. Technology Stack

### Frontend Architecture
- **Framework**: React 19 (SPA Auth & Session Manager) + Vanilla JavaScript (High-performance Canvas & Heatmap Engine).
- **Build System**: Vite 8 with ES Modules and optimized asset pipeline.
- **Rendering**: HTML5 Canvas 2D API for 60fps graph simulation; optimized DOM manipulation for matrix heatmaps.
- **Styling**: Vanilla CSS utilizing design tokens, CSS variables (`--bg`, `--fg`, `--hab0`–`--hab7`), and dark-mode aesthetics.
- **Typography**: Geist and Geist Mono via Google Fonts.

### Backend Architecture
- **Runtime**: Node.js (v18+ LTS).
- **Web Framework**: Express.js (REST API, static asset pipeline, security middleware).
- **Database ORM**: Mongoose ODM with connection pooling and schema validation.
- **Authentication**: `jsonwebtoken` (JWT) paired with `cookie-parser`.
- **Security**: `bcryptjs` for one-way credential hashing; configurable CORS policies.

### Cloud Database & Deployment
- **Database**: MongoDB Atlas (Cloud Database-as-a-Service with global replication).
- **Hosting Environment**: Production-ready for Render, Railway, Vercel, or custom Docker/Node containers.

---

## 4. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │  React 19 Auth App    │       │  Daylog Tracker View  │  │
│  │  - User Login/Signup  │       │  - Canvas Habit Graph │  │
│  │  - Session Banner     │◄─────►│  - Heatmap Engine     │  │
│  │  - Profile / Logout   │       │  - Local Cache (LS)   │  │
│  └──────────┬────────────┘       └───────────┬───────────┘  │
└─────────────┼────────────────────────────────┼──────────────┘
              │  POST /api/auth/*              │  GET/PUT /api/data
              │  (httpOnly JWT Cookie)         │  (Authenticated)
              ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Backend                       │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   Auth Middleware     │       │   Data Controller     │  │
│  │   - JWT Verification  │──────►│   - User-Scoped CRUD  │  │
│  │   - Cookie Validation │       │   - Timestamp Check   │  │
│  └───────────────────────┘       └───────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       MongoDB Atlas                         │
│                                                             │
│    Users Collection               Trackers Collection       │
│    ├── _id                        ├── _id                   │
│    ├── name                       ├── user (Ref: User)      │
│    ├── email (unique)             ├── json (Habits & Logs)  │
│    ├── passwordHash (bcrypt)      └── updated (timestamp)   │
│    └── createdAt                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema & Data Models

### User Model (`server/models/User.js`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `name` | `String` | Required, Trimmed | Display name of the user |
| `email` | `String` | Required, Unique, Lowercase, Indexed | Primary identity key |
| `passwordHash` | `String` | Required | Salted bcrypt hash (rounds: 10) |
| `createdAt` | `Date` | Default: `Date.now` | Account creation timestamp |

### Tracker Model (`server/models/Tracker.js`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `user` | `ObjectId` | Required, Unique, Ref: `'User'` | Foreign key referencing the owner user |
| `json` | `String` | Required | Complete serialized state (habits, logs, links, hierarchy) |
| `updated` | `Number` | Default: `Date.now` | Unix timestamp of the last recorded mutation |

---

## 6. REST API Specification

### Authentication Service (`/api/auth`)

| Endpoint | Method | Access | Body Payload | Response | Description |
|---|---|---|---|---|---|
| `/api/auth/signup` | `POST` | Public | `{ name, email, password }` | `{ user: { _id, name, email } }` | Creates a new account, signs JWT cookie |
| `/api/auth/signin` | `POST` | Public | `{ email, password }` | `{ user: { _id, name, email } }` | Authenticates credentials, sets JWT cookie |
| `/api/auth/logout` | `POST` | Public | None | `{ ok: true }` | Clears `token` cookie |
| `/api/auth/me` | `GET` | Authenticated | None | `{ user: { _id, name, email } }` | Validates session and returns current user |

### Data Synchronization Service (`/api/data`)

| Endpoint | Method | Access | Body Payload | Response | Description |
|---|---|---|---|---|---|
| `/api/data` | `GET` | Authenticated | None | `{ exists: Boolean, json?: String, updated?: Number }` | Fetches saved tracker payload for current user |
| `/api/data` | `PUT` | Authenticated | `{ json: String, updated: Number }` | `{ ok: true, updated: Number }` | Upserts tracker payload scoped to `req.userId` |

---

## 7. UI/UX Design Philosophy

- **Data-Dense Minimalism**: Prioritizes useful information over empty padding. Every pixel conveys status, streaks, frequency, or topological connections.
- **Dark Mode Ergonomics**: Built with high-contrast accessibility against an ultra-dark canvas (`#000000` / `#0a0a0a`), reducing eye strain during night tracking.
- **Direct Manipulation**: Click-to-log, inline step incrementors (`+1`, `+5`, `+10`), modal-free notes, and instant color switcher.
- **Vercel-Grade Microinteractions**: Subtle hover highlights, animated loading indicators, and toast notifications designed to make consistency enjoyable.

---

## 8. Development & Production Operations

### Environment Configuration
| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `4000` | Port for Express web and API server |
| `NODE_ENV` | `development` | Set to `production` for secure cookie enforcement and caching |
| `MONGO_URI` | `mongodb://localhost:27017/daylog` | MongoDB connection URI (local or Atlas) |
| `JWT_SECRET` | *Configurable* | Cryptographic salt used for signing JWT access tokens |
| `CLIENT_ORIGIN`| `http://localhost:5173` | CORS allowed origin in local development |

### Common Operational Commands
```bash
# Install dependencies for all subsystems
npm run install:all

# Launch full development environment (dual-process)
npm run server    # Backend on :4000
npm run client    # Vite frontend on :5173

# Production Build & Launch
npm run build     # Compiles React SPA and prepares client bundle
npm start         # Starts single-process fullstack server on configured PORT
```

---

## 9. Future Roadmap & Extensibility

- [ ] **Data Portability**: Native export/import engine supporting JSON schema and CSV backups.
- [ ] **Progressive Web App (PWA)**: Service worker installation for mobile offline access.
- [ ] **Habit Templates & Blueprints**: Pre-configured habit packs (e.g., Software Engineer Routine, Fitness Hypertrophy, Student Academics).
- [ ] **Analytical Reports**: Rolling 7-day, 30-day, and quarterly momentum trend graphs.
- [ ] **Public Profile Sharing**: Optional read-only shareable heatmap profiles for social accountability.
