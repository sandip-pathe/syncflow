# SyncFlow Demo Script

Use this script for a 60 to 90 second proof-of-work walkthrough.

## One-Sentence Positioning

SyncFlow is a durable AI workflow builder focused on the enterprise trust layer:
local demo execution, human approvals, eval gates, audit reports, and a preserved
Temporal path for production-style reliability.

## 60-90 Second Script

1. Start on the dashboard.

   "This is SyncFlow. It is not trying to be a generic workflow marketplace in
   two days. It focuses on what AI workflow builders need after the first demo:
   trust, approvals, evals, costs, and auditability."

2. Open `Private Market Diligence Review`.

   "The flagship template is a private-market diligence review. A reviewer can
   paste a memo or upload a text file, then run a workflow that extracts claims,
   flags risks, scores completeness, waits for partner approval, and drafts an
   IC memo section."

3. Click `Run`.

   "This is local demo mode. There is no Temporal, Redis, OpenAI key, Docker, or
   external service required. The same workflow definition shape is reused, but
   the local executor returns deterministic events and outputs for review."

4. Approve the `Partner Review` request.

   "The run pauses at the human gate. The modal waits for the approval API to
   succeed before closing, records the approver, and resumes the workflow. A
   rejection without a reject edge stops the run instead of accidentally
   continuing down the approval path."

5. Show the final report.

   "After approval, the report shows the memo, eval score, total cost, latency,
   approval decision, and node evidence. This is the operator view a real team
   needs when AI output affects business decisions."

6. Close with the architecture.

   "The production path is still Temporal-backed. Local mode makes the project
   easy to review, while Temporal mode keeps the long-running reliability story.
   The frontend normalizes both local response events and WebSocket events
   through the same path."

## What To Emphasize For VectorShift

- This is not a clone. It is a focused reliability layer underneath no-code AI
  workflows.
- The strongest product wedge is approval-critical workflows, not broad
  marketplace coverage.
- The demo is runnable locally by a recruiter or engineer.
- Temporal is preserved as the production durability story.
- The UI is designed as an operator surface, not a toy canvas.
- The README is honest about deterministic local AI outputs and missing PDF/DOCX
  parsing.

## Screenshot Checklist

The README uses screenshots from `docs/assets/`:

| File | Use |
| --- | --- |
| `syncflow-dashboard.png` | Shows the reviewer landing page and flagship workflow |
| `syncflow-builder.png` | Shows the operator-style canvas and workflow library |
| `syncflow-report.png` | Shows final report, metrics, approval, and audit trail |

Regenerate these after major UI changes.

## Follow-Up Pitch

If this became a larger product, the next work would be:

1. Source-grounded document ingestion with citations.
2. Eval suites for each workflow template.
3. Workflow versioning and diff review.
4. Approval policies by role and risk level.
5. Replayable execution history.
6. Cost and latency budgets per workflow.
7. Template analytics that show where users edit, fail, and abandon workflows.
