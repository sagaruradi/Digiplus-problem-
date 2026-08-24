# Smart Log Analyzer & Anomaly Detector

> **DigiPlus ACOE Technical Assessment** — *Full Stack Implementation (React + Node.js/Express + SQLite + Gemini AI)*

A high-performance, modular log ingestion, validation, deterministic anomaly detection, and AI-powered root-cause analysis system.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & System Design](#architecture--system-design)
3. [Gemini AI's Role & Architectural Boundary](#gemini-ais-role--architectural-boundary)
4. [Frontend Dashboard & User Flow](#frontend-dashboard--user-flow)
5. [Database Schema](#database-schema)
6. [Custom Anomaly Detection Logic](#custom-anomaly-detection-logic)
7. [Input Validation & Error Handling](#input-validation--error-handling)
8. [Synthetic Dataset](#synthetic-dataset)
9. [REST API Reference](#rest-api-reference)
10. [Setup & Running Instructions](#setup--running-instructions)
11. [Automated Tests & Live Verification](#automated-tests--live-verification)
12. [Assumptions & System Boundaries](#assumptions--system-boundaries)

---

## 1. Project Overview

The **Smart Log Analyzer** ingests and persists structured microservice logs, enforces validation schemas, and flags unusual entries using our own **deterministic, explainable rule engine**.

When an anomaly is selected by an engineer in the React dashboard, an on-demand **Gemini AI Root Cause Analysis** (`POST /api/logs/:id/analyze`) generates a plain-English summary of the incident, the likely technical root cause, and immediate remediation steps.

---

## 2. Architecture & System Design

```
React Frontend (Vite :3000) ───[ Reverse Proxy /api ]───► Express Server (:5000)
                                                                 │
      ┌────────────────────────┬─────────────────────────────────┴────────────────────────────────┐
      ▼                        ▼                                                                  ▼
Log Validators         Custom Detector                                                    SQLite (WAL Mode)
 (Schema & ISO)     (Deterministic Rules)                                                (logs Table + AI)
                               │                                                                  ▲
                               ▼ (ONLY for detected anomalies: isAnomaly=true)                    │
                     Gemini AI Service (@google/genai) ───────────────────────────────────────────┘
                    [Structured JSON: explanation, likelyRootCause, nextStep]
```

### Clean Directory Structure
```
digiplus-project/
├── backend/
│   ├── src/
│   │   ├── config/              # Centralized environment config (PORT, DB_PATH, GEMINI_MODEL)
│   │   ├── db/                  # SQLite connection & schema migrations
│   │   │   ├── database.js      # better-sqlite3 instance with WAL mode & auto-migrations
│   │   │   └── schema.sql       # logs table schema with AI explanation columns
│   │   ├── detector/            # Standalone deterministic anomaly detection engine
│   │   │   └── anomalyDetector.js
│   │   ├── validators/          # Input schema and payload validators
│   │   │   └── logValidator.js
│   │   ├── services/            # Log lifecycle, transactional batches, and Gemini AI integration
│   │   │   ├── logService.js
│   │   │   └── geminiService.js # Official @google/genai SDK with structured output
│   │   ├── controllers/         # REST API route handlers
│   │   │   └── logController.js
│   │   ├── routes/              # Express API route endpoints
│   │   │   ├── logRoutes.js
│   │   │   └── healthRoutes.js
│   │   ├── data/                # Synthetic enterprise logs (25 logs, 5 anomalies)
│   │   │   └── syntheticLogs.json
│   │   ├── app.js               # Express application configuration & error handling
│   │   └── server.js            # Server entry point with graceful shutdown
│   ├── tests/                   # Automated test suites
│   │   ├── detector.test.js     # 18 unit & persistence tests
│   │   ├── api.test.js          # 20 REST API integration tests
│   │   ├── gemini.test.js       # 7 Gemini service & endpoint mock tests
│   │   └── smoke-gemini.js      # Live Gemini AI API smoke test
│   ├── .env.example
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx              # App branding, live health indicator, seed & refresh actions
│   │   │   ├── StatsCards.jsx          # Metric cards (Total, Anomalies, Critical, Normal)
│   │   │   ├── LogFilters.jsx          # Status tabs, severity, source, and search inputs
│   │   │   ├── LogTable.jsx            # Highlighted log rows, score indicators, pagination
│   │   │   ├── LogDetailsModal.jsx     # Full details modal with copy payload & detection reasons
│   │   │   ├── AiAnalysisSection.jsx   # Gemini explanation, root cause, next step, loading & retry
│   │   │   └── EmptyState.jsx          # Empty database guidance with "Load Demo Logs" CTA
│   │   ├── services/
│   │   │   └── api.js                  # Centralized REST API client
│   │   ├── App.jsx                     # Dashboard coordinator
│   │   ├── main.jsx                    # React entry point
│   │   └── index.css                   # Dark mode design tokens & responsive styling
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── README.md                    # Project documentation
└── .gitignore
```

---

## 3. Gemini AI's Role & Architectural Boundary

1. **Deterministic Separation**: Anomaly detection is **100% rule/heuristic-based** and executed by our backend algorithm. **Gemini does NOT decide whether a log is anomalous** and cannot alter the anomaly score.
2. **On-Demand Execution**: Gemini is only invoked when explicitly requested for an already-flagged anomaly via `POST /api/logs/:id/analyze`. Normal logs reject AI requests with `400 Bad Request`.
3. **Structured JSON Output**: Uses official `@google/genai` with `responseSchema` to guarantee strict JSON output:
   ```json
   {
     "explanation": "The API Gateway's Web Application Firewall (WAF) intercepted and blocked a potential SQL injection attack targeting the 'accountId' query parameter with a suspicious 'UNION SELECT' string, triggering a 403 Forbidden error response.",
     "likelyRootCause": "An external malicious actor or automated vulnerability scanner attempted to execute unauthorized SQL commands through query input parameters.",
     "nextStep": "Investigate source IP addresses associated with the request to apply appropriate firewall or rate-limiting rules, and confirm backend API query handlers properly sanitize and parameterize all incoming database inputs."
   }
   ```
4. **Security**: `GEMINI_API_KEY` is kept strictly server-side in `.env` (ignored by git). It is never returned in API payloads or bundled into client code.

---

## 4. Frontend Dashboard & User Flow

### Step-by-Step Flow:
1. **Open Dashboard**: Loads summary metrics and live backend health connection badge.
2. **Empty Database State**: If unseeded, displays a clean empty state with a **"Load Demo Logs"** button.
3. **Seed Synthetic Logs**: Clicking seeds 25 realistic microservice logs (20 normal, 5 intentional anomalies).
4. **Explore & Filter**:
   - Filter by Status (**All Logs**, **Anomalies Only**, **Normal Logs**).
   - Filter by Severity (`CRITICAL`, `FATAL`, `ERROR`, `WARN`, `INFO`).
   - Filter by Source Service (`auth-service`, `database-cluster`, `payment-gateway`, etc.).
   - Search across message text, source name, or event category.
5. **View Anomaly Details**: Clicking any row opens the Log Detail Modal displaying:
   - Complete original log metadata (formatted payload with 1-click copy).
   - Deterministic Anomaly Engine score (e.g. `75/100`) and triggered heuristic rules list.
6. **On-Demand AI Root Cause Analysis**:
   - For an unanalyzed anomaly: Click **"Analyze with Gemini AI"**.
   - Live loading state displays while Gemini processes.
   - Plain-English explanation, technical root cause, and next step are saved to SQLite and rendered immediately.
7. **Instant Cached Display**: Re-opening a previously analyzed log displays the saved AI diagnosis instantly from SQLite without re-calling Gemini.
8. **Normal Log Guard**: Opening a normal log explicitly explains that AI root-cause analysis is reserved for detected anomalies.

---

## 5. Database Schema

Stored in `backend/src/db/logs.sqlite` with **WAL Mode** enabled:

```sql
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  eventType TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  isAnomaly INTEGER NOT NULL DEFAULT 0,
  anomalyScore REAL NOT NULL DEFAULT 0.0,
  anomalyReason TEXT,
  createdAt TEXT NOT NULL,
  aiExplanation TEXT,
  aiRootCause TEXT,
  aiNextStep TEXT,
  aiGeneratedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_isAnomaly ON logs(isAnomaly);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
CREATE INDEX IF NOT EXISTS idx_logs_eventType ON logs(eventType);
```

---

## 6. Custom Anomaly Detection Logic

Implemented in [`backend/src/detector/anomalyDetector.js`](backend/src/detector/anomalyDetector.js):

| Signal | Condition | Weight |
|---|---|---|
| **Severity** | `FATAL` | **+50** |
| | `CRITICAL` | **+45** |
| | `ERROR` | **+25** |
| | `WARN` / `WARNING` | **+10** |
| | `INFO` / `DEBUG` | **+0** |
| **HTTP Server Errors** | `500` - `599` (e.g. 500, 502, 503, 504) | **+30** |
| **Auth / Rate Limit** | `401`, `403`, `429` | **+20** |
| **Failure Status Flags**| `TIMEOUT`, `TIMED_OUT`, `FAILED`, `FAILURE`, `DEADLOCK`, `CRASH`, `PANIC` | **+25** |
| **Degraded Status** | `DEGRADED`, `CIRCUIT_BROKEN` | **+20** |

### High-Risk Keyword Categories (with Deduplication)
- **`database_deadlock`** (`deadlock`, `lock wait timeout`): **+30**
- **`security_assault`** (`brute force`, `credential stuffing`, `sql injection`, `privilege escalation`): **+30**
- **`memory_exhaustion`** (`out of memory`, `heap out of memory`, `oom`, `memory leak`): **+35**
- **`process_crash`** (`segmentation fault`, `segfault`, `core dumped`, `unhandled rejection`): **+35**
- **`network_connectivity`** (`connection refused`, `upstream timeout`, `socket hang up`): **+20**
- **`circuit_breaker`** (`circuit breaker opened`, `circuit breaker tripped`): **+25**

### Repeat IP Offender Cumulative Scoring (Database Lookups)
When a log originates from or contains an IP address, the system queries SQLite for recent failure events (`401`, `403`, `429`, `5xx`, `TIMEOUT`, `FAILED`, or flagged anomalies) within a 15-minute rolling window:
- **$2 - 4$ prior failures**: **+15 points** (*"Repeat offender: 3 recent failure incidents from IP 192.168.1.105 (+15)"*)
- **$5 - 9$ prior failures**: **+30 points** (*"Repeat offender: High-frequency attack (7 recent failures) from IP 192.168.1.105 (+30)"*)
- **$\ge 10$ prior failures**: **+50 points** (*"Repeat offender: Sustained assault (12 recent failures) from IP 192.168.1.105 (+50)"*)

**Default Threshold**: `50` (Score $\ge 50 \implies \text{isAnomaly} = \text{true}$).

---

## 7. Synthetic Dataset

Located in [`backend/src/data/syntheticLogs.json`](backend/src/data/syntheticLogs.json):
- **Total Records**: 25 realistic enterprise microservice log entries.
- **Normal Records**: 20 (80%) — OAuth logins, order creations, Redis cache fetches, health telemetry.
- **Anomalous Records**: 5 (20%) —
  1. Database deadlock on ledger resource (`database-cluster`, `CRITICAL`, `DEADLOCK`, score: 100)
  2. Brute-force credential assault (`auth-service`, `ERROR`, `401`, score: 75)
  3. Upstream 504 Gateway Timeout cascade (`payment-gateway`, `CRITICAL`, `504`, score: 100)
  4. Worker process heap out-of-memory crash (`worker-service`, `FATAL`, `CRASH`, score: 100)
  5. WAF SQL injection exploit attempt (`api-gateway`, `ERROR`, `403`, score: 75)

---

## 8. REST API Reference

### Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/api/health` | Service and SQLite WAL health check | `200` |
| `GET` | `/api/logs` | Query logs with filters (`isAnomaly`, `severity`, `source`, `search`, `limit`, `offset`) | `200` |
| `GET` | `/api/logs/:id` | Fetch single log entry with saved AI fields | `200` / `404` |
| `GET` | `/api/logs/stats` | Dataset statistics (total, anomalies, analyzed count, rate) | `200` |
| `POST` | `/api/logs` | Ingest, score, and persist single log | `201` / `400` |
| `POST` | `/api/logs/import` | Transactional batch ingestion | `201` / `400` |
| `POST` | `/api/logs/seed` | Reset and populate database with synthetic dataset | `201` |
| `POST` | `/api/logs/:id/analyze` | **Trigger Gemini AI root cause analysis for an anomaly** | `200` / `400` / `404` |
| `DELETE`| `/api/logs/:id` | Delete log entry by ID | `200` / `404` |
| `DELETE`| `/api/logs` | Clear all logs from database | `200` |

---

## 9. Setup & Running Instructions

### 1. Configure Environment
Create or verify `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DB_PATH=./src/db/logs.sqlite
ANOMALY_SCORE_THRESHOLD=50
GEMINI_MODEL=gemini-3.6-flash
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Start the Backend
```bash
cd backend
npm install
npm run dev
# Server running at http://localhost:5000
```

### 3. Start the Frontend Dashboard
```bash
# In a separate terminal:
cd frontend
npm install
npm run dev
# Dashboard running at http://localhost:3000
```
Open **`http://localhost:3000`** in your browser.

---

## 10. Automated Tests & Live Verification

### 1. Run Complete Automated Test Suite (45 Tests, Zero Quota Usage)
```bash
cd backend
npm test
```

### 2. Run Live Gemini Smoke Test (Real API Call)
```bash
cd backend
node tests/smoke-gemini.js
```

---

## 11. Assumptions & System Boundaries

- **Deterministic Rule Engine**: Anomaly scores are computed deterministically based on severity, status codes, keywords, and compound patterns. Gemini AI is not involved in anomaly detection.
- **On-Demand Analysis**: AI calls are triggered individually on demand to respect free-tier rate limits and prevent quota exhaustion.
- **SQLite WAL Mode**: Provides fast zero-dependency concurrency without needing Docker or Redis.
