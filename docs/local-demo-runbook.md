# How to Run the Local SyncFlow Demo

This guide gets SyncFlow running in local demo mode and walks through the
private-market diligence workflow end to end.

## Prerequisites

- Node.js 18 or newer.
- Python 3.11 or newer.
- A shell that can run PowerShell-style commands on Windows.
- No Temporal, Redis, OpenAI key, Docker, or external model provider is needed
  for local mode.

## Start the Backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
$env:PYTHONIOENCODING = "utf-8"
$env:EXECUTION_BACKEND = "local"
uvicorn app.main:app --reload --port 8000
```

Verify:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/
```

Expected content includes:

```json
{"message":"SyncFlow API","status":"running"}
```

## Start the Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run the Flagship Workflow

1. Open the dashboard.
2. Choose `Private Market Diligence Review`.
3. Click `Run`.
4. Paste diligence notes or upload a text-like file.
5. Click `Run Review`.
6. Wait for the run to pause at `Partner Review`.
7. Approve the request.
8. Inspect the final report modal.

The report should show:

- Investment committee memo draft.
- Eval score.
- Total cost.
- Total latency.
- Node count.
- Approval decision and approver.
- Extracted claims, risks, and assumptions.
- Audit trail.

## Upload Support

Local mode reads text files in the browser. Supported upload extensions:

- `.txt`
- `.md`
- `.markdown`
- `.json`
- `.csv`

PDF and DOCX parsing are intentionally not implemented in this proof-of-work.
For those files, paste extracted text into the run modal.

## Run Temporal Mode

Temporal mode is preserved for production-style execution:

```powershell
$env:EXECUTION_BACKEND = "temporal"
$env:DATABASE_URL = "<postgres-url>"
$env:REDIS_URL = "<redis-url>"
$env:TEMPORAL_HOST = "<temporal-host>"
$env:TEMPORAL_NAMESPACE = "<temporal-namespace>"
$env:OPENAI_API_KEY = "<openai-key>"
uvicorn app.main:app --reload --port 8000
```

In Temporal mode, the execute endpoint starts the Temporal workflow and the UI
continues to receive runtime updates through WebSocket events.

## QA Commands

Backend:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```

Frontend:

```powershell
cd frontend
npm run test
npm run lint
npm run build
```

Repository:

```powershell
git diff --check
```

## Troubleshooting

### Backend prints encoding errors on Windows

Set:

```powershell
$env:PYTHONIOENCODING = "utf-8"
```

Then restart Uvicorn.

### Frontend build succeeds but dev server serves stale chunks

Stop `npm run dev`, run the build, then restart `npm run dev`. Next.js can serve
stale development chunks if the dev server stays open while `.next` is rebuilt.

### Run does not open the approval modal

Confirm the backend is in local mode:

```powershell
$env:EXECUTION_BACKEND
```

Then reload the workflow page and run again. In local mode the execute response
includes `pending_approval`, which opens the modal directly.

### Approval succeeds but no report opens

Check the browser console and backend logs. The approval response should include
`events` and `output` in local mode. The frontend applies those continuation
events through `frontend/lib/workflow-events.ts`.
