# SyncFlow Frontend

Next.js interface for the durable AI workflow builder proof-of-work.

The frontend focuses on the reviewer path:

- Dashboard with the Private Market Diligence Review template first.
- React Flow workflow builder with approval, eval, agent, trigger, and end nodes.
- Local demo run modal for pasted text or text-file inputs.
- Approval modal that waits for the resume API to succeed before closing.
- Completed-run report modal with final output, approval decision, eval score, cost, latency, and node evidence.

## Run Locally

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The frontend expects the backend at `http://localhost:8000` by default. Override it with:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## QA Commands

```bash
npm run lint
npm run test
npm run build
```

## Demo Notes

Local mode accepts TXT, Markdown, JSON, and CSV uploads, or pasted text. PDF and DOCX parsing are intentionally not implemented in this 2-day proof-of-work; paste extracted text from those files for the local demo.

## Project Docs

Start with the root [README](../README.md), then use:

- [Architecture](../docs/architecture.md)
- [Local Demo Runbook](../docs/local-demo-runbook.md)
- [API And Events Reference](../docs/api-and-events.md)
- [Demo Script](../docs/demo-script.md)
