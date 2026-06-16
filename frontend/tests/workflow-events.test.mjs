import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadWorkflowEventsModule() {
  const source = fs.readFileSync(
    path.join(rootDir, "lib", "workflow-events.ts"),
    "utf8"
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };

  vm.runInNewContext(
    outputText,
    {
      exports: module.exports,
      module,
      require: (id) => {
        throw new Error(`Unexpected runtime import in workflow event test: ${id}`);
      },
    },
    { filename: "workflow-events.ts" }
  );

  return module.exports;
}

const {
  approvalFromEvent,
  approvalFromPendingApproval,
  getNodeStatusForEvent,
  normalizeBackendEvent,
  normalizeBackendEvents,
  resetWorkflowNodeRuntime,
} = loadWorkflowEventsModule();

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("normalizes legacy approval events into frontend approval requests", () => {
  const event = normalizeBackendEvent({
    event_type: "hitl.approval.requested",
    timestamp: "2026-06-15T12:00:00.000Z",
    data: JSON.stringify({
      workflow_id: "workflow-1",
      execution_id: "execution-1",
      node_id: "approval-1",
      approval_id: "approval-request-1",
      title: "Partner Review",
      description: "Review flagged risks.",
      context: { score: 0.88 },
    }),
  });

  assert.equal(event.workflowId, "workflow-1");
  assert.equal(event.executionId, "execution-1");
  assert.equal(event.nodeId, "approval-1");
  assert.equal(getNodeStatusForEvent(event), "waiting_approval");

  assert.deepEqual(plain(approvalFromEvent(event)), {
    id: "approval-request-1",
    executionId: "execution-1",
    nodeId: "approval-1",
    title: "Partner Review",
    description: "Review flagged risks.",
    context: { score: 0.88 },
    status: "pending",
    requestedAt: "2026-06-15T12:00:00.000Z",
  });
});

test("normalizes local execute response events as a batch", () => {
  const events = normalizeBackendEvents([
    {
      event_type: "node.completed",
      timestamp: 1781542872,
      data: {
        workflow_id: "workflow-1",
        execution_id: "execution-1",
        node_id: "diligence-eval",
        result: {
          passed: true,
          score: 0.88,
          reason: "Claims, risk flags, and approval context are present.",
        },
      },
    },
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "node.completed");
  assert.equal(events[0].nodeId, "diligence-eval");
  assert.equal(events[0].data.score, 0.88);
  assert.equal(getNodeStatusForEvent(events[0]), "completed");
});

test("maps approval audit events to node statuses", () => {
  assert.equal(
    getNodeStatusForEvent({
      eventType: "approval.granted",
      nodeId: "approval-1",
      workflowId: "workflow-1",
      executionId: "execution-1",
      id: "granted",
      timestamp: "2026-06-15T12:00:00.000Z",
      data: { action: "approved" },
    }),
    "completed"
  );

  assert.equal(
    getNodeStatusForEvent({
      eventType: "approval.denied",
      nodeId: "approval-1",
      workflowId: "workflow-1",
      executionId: "execution-1",
      id: "denied",
      timestamp: "2026-06-15T12:00:00.000Z",
      data: { action: "rejected" },
    }),
    "failed"
  );
});

test("maps local pending_approval payloads into modal state", () => {
  const approval = approvalFromPendingApproval({
    id: "approval-request-1",
    execution_id: "execution-1",
    node_id: "diligence-approval",
    title: "Partner Review",
    description: "Review risk framing before memo generation.",
    context: { score: 0.88 },
    requested_at: "2026-06-15T12:00:00.000Z",
  });

  assert.deepEqual(plain(approval), {
    id: "approval-request-1",
    executionId: "execution-1",
    nodeId: "diligence-approval",
    title: "Partner Review",
    description: "Review risk framing before memo generation.",
    context: { score: 0.88 },
    status: "pending",
    requestedAt: "2026-06-15T12:00:00.000Z",
  });
});

test("resets transient node runtime fields before loading or re-running", () => {
  const nodes = resetWorkflowNodeRuntime([
    {
      id: "agent-1",
      type: "agent",
      position: { x: 0, y: 0 },
      data: {
        label: "Extract Claims",
        type: "agent",
        status: "completed",
        cost: 0.42,
        executionTime: 1.2,
        lastResult: { output: "old result" },
        error: "old error",
        config: { name: "Extract Claims" },
      },
    },
  ]);

  assert.equal(nodes[0].data.status, "idle");
  assert.equal("cost" in nodes[0].data, false);
  assert.equal("executionTime" in nodes[0].data, false);
  assert.equal("lastResult" in nodes[0].data, false);
  assert.equal("error" in nodes[0].data, false);
  assert.equal(nodes[0].data.label, "Extract Claims");
});
