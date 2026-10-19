# Daylog — Full-Stack Habit & Skill Tracker

A habit tracker with per-habit GitHub heatmaps, an Obsidian-style graph view, and challenge goals — now with **user authentication and cloud sync** powered by Node.js + Express + MongoDB.

---

## Architecture

```
e:\New folder\
├── server/           ← Express + MongoDB backend (port 4000)
│   ├── index.js      ← entry point
│   ├── .env          ← environment variables (edit this!)
│   ├── models/
│   │   ├── User.js   ← bcrypt password hash, JWT helpers
│   │   └── Tracker.js← one JSON blob per user
│   ├── middleware/
│   │   └── auth.js   ← issueToken, requireAuth (JWT cookie)
│   └── routes/
│       ├── auth.js   ← POST /api/auth/signup|signin|logout  GET /api/auth/me
│       └── data.js   ← GET/PUT /api/data (protected)
├── client/           ← React (Vite) auth UI (port 5173 in dev)
│   └── src/
│       ├── api.js            ← fetch wrappers for backend
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── AuthPage.jsx  ← sign in / sign up UI
│       │   ├── AuthBar.jsx   ← top bar with avatar + logout
│       │   └── Dashboard.jsx ← embeds tracker in iframe
│       └── App.jsx           ← routes between Auth / Dashboard
└── public/           ← original vanilla JS tracker (served at /tracker)
    ├── index.html
    ├── daylog.css
    └── daylog.js     ← patched: REST API sync instead of Firebase
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 + |
| npm | 9 + |
| MongoDB | Running locally on mongodb://localhost:27017 OR an Atlas connection string |

---

## Quick Start

### 1 — Configure the server

Edit server/.env:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/daylog
JWT_SECRET=replace_with_a_long_random_string_in_production
CLIENT_ORIGIN=http://localhost:5173
```

Change JWT_SECRET before deploying to production!

### 2 — Open two terminal windows

Terminal 1 — Start the backend:

```powershell
cd "E:\New folder\server"
npm run dev
```

Expected output:
  MongoDB connected: mongodb://localhost:27017/daylog
  Server running at http://localhost:4000

Terminal 2 — Start the React auth UI:

```powershell
cd "E:\New folder\client"
npm run dev
```

Open http://localhost:5173 in your browser.

---

## API Reference

| Method | Route | Auth Required | Description |
|--------|-------|------|-------------|
| POST | /api/auth/signup | No | Register new user |
| POST | /api/auth/signin | No | Sign in, receive JWT cookie |
| POST | /api/auth/logout | No | Clear JWT cookie |
| GET  | /api/auth/me    | Yes | Return current user |
| GET  | /api/data       | Yes | Load tracker state |
| PUT  | /api/data       | Yes | Save tracker state |

Auth uses httpOnly JWT cookies (30-day expiry).

---

## How data sync works

1. On sign-in the tracker calls GET /api/data
2. Last-write-wins using the updated timestamp
3. Every change triggers a debounced (700 ms) PUT /api/data
4. Sync status shows in the sidebar: Saved in browser → Saving... → Synced to your account

---

## 🚀 Making the App Live (Production Deployment)

This app is configured to run as a **single full-stack service** (Express serves the REST API, the React Auth SPA, and the `/tracker` vanilla interface all in one place).

### Step 1: Create a Free Cloud Database (MongoDB Atlas)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for free.
2. Create a **Free Shared Cluster (M0)**.
3. Under **Security → Database Access**, create a database user (e.g., `daylog_user`) with a strong password.
4. Under **Security → Network Access**, click **Add IP Address** → choose **Allow Access From Anywhere** (`0.0.0.0/0`) so cloud hosting providers can connect.
5. In **Database → Clusters**, click **Connect** → **Drivers** (Node.js) and copy your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/daylog?retryWrites=true&w=majority
   ```
   *(Replace `<username>` and `<password>` with your database user credentials).*

---

### Step 2: Push Your Code to GitHub
Open your terminal in the project root:
```bash
git init
git add .
git commit -m "Initial commit of fullstack Daylog app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```
*(The `.gitignore` will ensure your `node_modules` and local `.env` are never exposed).*

---

### Step 3: Deploy to Render (Recommended — Free)
1. Sign in to [Render](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Name**: `daylog` (or your preferred name)
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. Scroll down to **Environment Variables** and add:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` *(Render sets this automatically, but good to have)*
   - `MONGO_URI` = *(Paste your MongoDB Atlas connection string from Step 1)*
   - `JWT_SECRET` = *(Generate a random 32+ character string)*
6. Click **Deploy Web Service**.

Render will install dependencies, build the React frontend, start the Express server, and give you a live HTTPS URL (e.g. `https://daylog-xyz.onrender.com`).

---

### Step 4: Verify Your Live App
1. Visit your Render URL.
2. Create a new account on the live Auth page.
3. Test adding habits and logging entries — your data is securely stored in MongoDB Atlas and synced automatically!

