# Minimal AI Customer Support Agent

A production-grade, full-stack customer support application featuring secure JWT authentication via `httpOnly` cookies, per-user persistent conversation history in MongoDB, resilient AI completion using OpenRouter, and containerization with multi-stage Dockerfiles.

---

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Third-Party Setup Guides](#third-party-setup-guides)
   - [OpenRouter API Key](#1-how-to-get-an-openrouter-api-key)
   - [MongoDB Atlas URI](#2-how-to-get-a-mongodb-atlas-uri)
5. [Environment Variables](#environment-variables)
6. [Local Development](#local-development)
   - [Method A: Running with Docker (Recommended)](#method-a-running-with-docker-recommended)
   - [Method B: Running without Docker](#method-b-running-without-docker)
7. [Testing & Verification](#testing--verification)
8. [API Reference](#api-reference)
9. [Production Deployment Guide](#production-deployment-guide)
   - [Deploying Backend (Render / Railway)](#1-deploying-backend-render--railway)
   - [Deploying Frontend (Vercel / Netlify)](#2-deploying-frontend-vercel--netlify)
   - [Cross-Domain Cookie Configuration](#3-cross-domain-cookie-configuration)
10. [Known Limitations & Architecture Decisions](#known-limitations--architecture-decisions)

---

## Overview

The **Minimal AI Customer Support Agent** provides users with an intuitive support interface:
- **Tenant Isolation**: Conversations and messages are strictly scoped to the authenticated user ID. Users can never view or modify another user's conversations.
- **Resilient AI Pipeline**: Polite, concise customer support system prompt. If a model encounters provider downtime or upstream rate limits, requests automatically retry against a fallback model, returning friendly user-facing messages rather than raw provider errors.
- **Enterprise Security**: JWTs stored in `httpOnly`, `sameSite`, `secure` cookies (no localStorage tokens vulnerable to XSS). Passwords hashed using `bcryptjs` with 12 salt rounds. Helmet security headers, rate limiting (global, auth, and chat), and payload bounds.
- **Responsive UX**: Plain modular CSS (no Tailwind dependency), animated typing indicator, message auto-scrolling, session auto-recovery, and mobile drawer sidebar.

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18 + Vite 5 | Fast SPA with functional components & React Hooks |
| **Styling** | Plain CSS | Modern flexbox/grid layout, CSS custom properties, responsive down to mobile |
| **HTTP Client** | Axios | Configured with `withCredentials: true` for automatic cookie transmission |
| **Backend** | Node.js 20 + Express | ES modules (`"type": "module"`), modular router architecture |
| **Database** | MongoDB + Mongoose | Schema modeling, indexing, and tenant-scoped queries |
| **Auth** | JWT + bcryptjs | 7-day signed JWTs stored in `httpOnly` cookies; 12 salt rounds |
| **AI Integration** | OpenRouter API | Dynamic model routing via `openrouter/free` with 30s timeout and graceful fallback |
| **DevOps** | Docker + Docker Compose | Multi-stage Dockerfiles for lean backend and Nginx-powered frontend |

---

## Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: (Optional, for containerized execution)
- **MongoDB**: Local MongoDB instance or free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster

---

## Third-Party Setup Guides

### 1. How to Get an OpenRouter API Key
1. Go to [OpenRouter.ai](https://openrouter.ai/) and create a free account.
2. Navigate to **Keys** in your dashboard: [openrouter.ai/keys](https://openrouter.ai/keys).
3. Click **Create Key**, give it a name (e.g., `Customer Support Agent`), and copy the key (format: `sk-or-v1-...`).
4. Paste the key into `server/.env` under `OPENROUTER_API_KEY`.

### 2. How to Get a MongoDB Atlas URI
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. Create a free **Shared M0** cluster (choose your closest cloud provider region).
3. Under **Security → Database Access**, create a database user with username and password (e.g. `admin` and a strong password).
4. Under **Security → Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`) for development.
5. Under **Deployment → Database**, click **Connect** → **Drivers** (Node.js).
6. Copy the connection string and replace `<password>` with your database user password:
   ```text
   mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/ai-support-agent?retryWrites=true&w=majority
   ```
7. Paste this into `server/.env` under `MONGODB_URI`.

---

## Environment Variables

### Server Configuration (`server/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`) |
| `PORT` | No | `5050` (or `5000`) | Port the Express server listens on |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/ai-support-agent` | MongoDB Atlas or local connection string |
| `JWT_SECRET` | Yes | — | Secret key used to sign and verify JWT tokens |
| `CLIENT_URL` | No | `http://localhost:5173` | Allowed CORS origin (must match client URL) |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API bearer token |
| `OPENROUTER_MODEL` | No | `openrouter/free` | Primary model identifier |
| `OPENROUTER_FALLBACK_MODEL` | No | `nvidia/nemotron-3.5-lightning:free` | Fallback model if primary model fails |

### Client Configuration (`client/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5050` | Base URL of the backend API |

---

## Local Development

### Method A: Running with Docker (Recommended)

From a clean clone:

1. Create and populate `server/.env`:
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your JWT_SECRET and OPENROUTER_API_KEY
   ```

2. Build and start containers:
   ```bash
   # Option 1: Using your own MongoDB (Atlas or remote)
   docker compose up --build

   # Option 2: Using the built-in isolated local MongoDB container
   docker compose --profile local-db up --build
   ```

3. Open **`http://localhost:5173`** in your browser.

---

### Method B: Running without Docker

#### 1. Start MongoDB
- **Local MongoDB**:
  ```bash
  mongod --config /opt/homebrew/etc/mongod.conf
  ```
- **MongoDB Atlas**: Put your Atlas connection string in `server/.env`.

#### 2. Start Backend Server
```bash
cd server
npm install
npm run dev
```
*(Server listens on `http://localhost:5050` with `--watch` auto-reloading)*.

> **macOS Note**: macOS AirPlay Receiver occupies port `5000` by default. We configure port `5050` in `.env` to avoid `EADDRINUSE` collisions.

#### 3. Start Frontend Client
```bash
cd client
npm install
npm run dev
```
*(Vite client starts on `http://localhost:5173`)*.

4. Open **`http://localhost:5173`** in your browser.

---

## Testing & Verification

The project includes unit, integration, and full browser end-to-end test suites.

### Backend Test Suite (29 Tests)
Hermetic tests covering health checks, authentication, password security, conversation persistence, multi-tenant isolation, AI provider timeouts, fallback recovery, rate limiting, and security bounds:
```bash
cd server
npm test
```

### Frontend End-to-End Browser Tests (4 Tests)
Automated user journey test using headless Chrome (Puppeteer):
```bash
cd client
npm run test:e2e
```
*Verifies: Initial load → Signup → Message send → Typing indicator → Assistant response → Browser reload with session & history persistence → Logout.*

---

## API Reference

All protected endpoints require the `token` httpOnly cookie.

### Health
- **`GET /health`**
  - **Auth**: Public
  - **Response**: `200 OK`
    ```json
    { "ok": true }
    ```

### Authentication
- **`POST /auth/signup`**
  - **Auth**: Public (Rate limit: 10 req / 15 min)
  - **Body**: `{ "email": "user@example.com", "password": "Password123!" }`
  - **Response**: `201 Created` with `set-cookie: token=...; HttpOnly`
    ```json
    {
      "user": {
        "_id": "6722...",
        "email": "user@example.com",
        "createdAt": "2026-10-30T..."
      }
    }
    ```

- **`POST /auth/login`**
  - **Auth**: Public (Rate limit: 10 req / 15 min)
  - **Body**: `{ "email": "user@example.com", "password": "Password123!" }`
  - **Response**: `200 OK` with `set-cookie: token=...; HttpOnly`

- **`POST /auth/logout`**
  - **Auth**: Protected
  - **Response**: `200 OK` with cleared cookie
    ```json
    { "message": "Logged out successfully." }
    ```

- **`GET /auth/me`**
  - **Auth**: Protected
  - **Response**: `200 OK`
    ```json
    {
      "user": {
        "_id": "6722...",
        "email": "user@example.com",
        "createdAt": "2026-10-30T..."
      }
    }
    ```

### Chat & Customer Support
- **`POST /chat/send`**
  - **Auth**: Protected (Rate limit: 20 req / 1 min)
  - **Body**: `{ "message": "How do I return an item?", "conversationId": "optional-id" }`
  - **Behavior**: Appends user message, fetches last 10 messages for AI context, triggers AI completion, saves assistant reply.
  - **Response**: `200 OK`
    ```json
    {
      "conversationId": "6722...",
      "userMessage": {
        "_id": "6722...",
        "role": "user",
        "content": "How do I return an item?",
        "createdAt": "2026-10-30T..."
      },
      "message": {
        "_id": "6722...",
        "role": "assistant",
        "content": "Our return policy allows returns within 30 days of purchase...",
        "createdAt": "2026-10-30T..."
      }
    }
    ```

- **`GET /chat/history`**
  - **Auth**: Protected
  - **Response**: `200 OK`
    ```json
    {
      "conversations": [
        {
          "_id": "6722...",
          "title": "How do I return an item?",
          "createdAt": "2026-10-30T...",
          "updatedAt": "2026-10-30T..."
        }
      ]
    }
    ```

- **`GET /chat/history/:conversationId`**
  - **Auth**: Protected (strictly scoped to owner)
  - **Response**: `200 OK`
    ```json
    {
      "conversation": { "_id": "6722...", "title": "..." },
      "messages": [
        { "_id": "...", "role": "user", "content": "..." },
        { "_id": "...", "role": "assistant", "content": "..." }
      ]
    }
    ```

---

## Production Deployment Guide

### 1. Deploying Backend (Render / Railway)

1. **Create Web Service**:
   - Link your GitHub repository.
   - Set **Root Directory**: `server`
   - Set **Build Command**: `npm install`
   - Set **Start Command**: `npm start`
2. **Configure Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://admin:...@cluster0.mongodb.net/ai-support-agent
   JWT_SECRET=your-random-32-byte-secret-key
   CLIENT_URL=https://your-frontend-app.vercel.app
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=openrouter/free
   OPENROUTER_FALLBACK_MODEL=nvidia/nemotron-3.5-lightning:free
   ```

### 2. Deploying Frontend (Vercel / Netlify)

1. **Create New Project**:
   - Link your GitHub repository.
   - Set **Root Directory**: `client`
   - Set **Build Command**: `npm run build`
   - Set **Output Directory**: `dist`
2. **Environment Variable**:
   ```env
   VITE_API_URL=https://your-backend-service.onrender.com
   ```
3. **SPA Routing Fallback**:
   - **Vercel**: Add `client/vercel.json`:
     ```json
     {
       "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
     }
     ```
   - **Netlify**: Add `client/public/_redirects`:
     ```text
     /*    /index.html   200
     ```

### 3. Cross-Domain Cookie Configuration

When deploying client and server on separate domains (e.g. `app.vercel.app` and `api.onrender.com`), browsers enforce third-party cookie restrictions:

1. **`sameSite: "none"`**: Allows the browser to include the auth cookie on cross-site requests from the client to the server.
2. **`secure: true`**: Mandatory whenever `sameSite: "none"` is used (cookies are only transmitted over HTTPS).
3. **`withCredentials: true`**: Configured in Axios ([`client/src/api/client.js`](file:///Users/kaaviyahprakasam/Downloads/virallens-ai-agent/client/src/api/client.js)) so the browser sends and stores cookies across domains.
4. **CORS Headers**: Express must respond with:
   - `Access-Control-Allow-Origin: https://your-frontend-app.vercel.app` (cannot be `*`)
   - `Access-Control-Allow-Credentials: true`

*Our codebase dynamically handles this via `isProduction` in [`server/src/config/env.js`](file:///Users/kaaviyahprakasam/Downloads/virallens-ai-agent/server/src/config/env.js).*

---

## Known Limitations & Architecture Decisions

1. **Free-Tier Cold Starts**:
   - Free instances on Render, Railway, or Fly.io spin down after 15 minutes of inactivity. Initial requests after idle may experience a 30-50 second delay while the container boots.
2. **OpenRouter Free Model Availability**:
   - Individual free models (e.g. Llama 3.3 free) frequently transition to paid tiers or encounter upstream capacity limits (HTTP 429).
   - *Mitigation*: We default to **`openrouter/free`** (which auto-balances across active free providers) and configure an automated fallback model retry in `server/src/services/ai.js`.
3. **Distributed Rate Limiting**:
   - `express-rate-limit` currently uses an in-memory counter. If scaling horizontally across multiple container instances, configure a Redis store adapter (`rate-limit-redis`) to share rate limit counts across replicas.

