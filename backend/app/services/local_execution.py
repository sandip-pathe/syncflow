"""Deterministic local workflow execution for reviewer-friendly demos."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.workflow import ApprovalRequest, Execution


class LocalWorkflowExecutor:
    """Runs workflow definitions without Temporal, Redis, or model providers."""

    def start(
        self,
        *,
        db: Session,
        workflow_id: str,
        workflow_def: Dict[str, Any],
        execution: Execution,
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        state = {
            "workflow_id": workflow_id,
            "execution_id": execution.id,
            "is_diligence_template": workflow_id == "template-private-market-diligence",
            "input": input_data,
            "node_outputs": {},
            "history": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "last_result": None,
        }
        events = [
            self._event(
                "workflow.started",
                workflow_id=workflow_id,
                execution_id=execution.id,
            )
        ]
        start_node_id = self._find_start_node_id(workflow_def.get("nodes", []))
        return self._run_from(
            db=db,
            workflow_def=workflow_def,
            execution=execution,
            state=state,
            current_node_id=start_node_id,
            events=events,
        )

    def resume_after_approval(
        self,
        *,
        db: Session,
        workflow_def: Dict[str, Any],
        execution: Execution,
        approval: ApprovalRequest,
        approval_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        output_data = execution.output_data or {}
        state = output_data.get("local_state")
        if not isinstance(state, dict):
            raise ValueError("Local execution state was not found for this approval.")

        workflow_id = execution.workflow_id
        execution_id = execution.id
        approval_node_id = approval.node_id
        node_map = self._node_map(workflow_def.get("nodes", []))
        approval_node = node_map.get(approval_node_id)
        if not approval_node:
            raise ValueError(f"Approval node '{approval_node_id}' was not found.")

        state["node_outputs"][approval_node_id] = approval_result
        state["last_result"] = approval_result
        state["history"].append(
            {
                "node_id": approval_node_id,
                "type": "approval",
                "label": self._node_label(approval_node),
                "status": "success",
                "result": approval_result,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        approval_event_type = (
            "approval.granted"
            if approval_result.get("action") == "approved"
            else "approval.denied"
        )
        events = [
            self._event(
                "node.completed",
                workflow_id=workflow_id,
                execution_id=execution_id,
                node_id=approval_node_id,
                node_type="approval",
                result=approval_result,
            ),
            self._event(
                approval_event_type,
                workflow_id=workflow_id,
                execution_id=execution_id,
                node_id=approval_node_id,
                node_type="approval",
                result=approval_result,
            ),
        ]
        next_node_id = self._get_next_node_id(
            approval_node,
            workflow_def.get("edges", []),
            approval_result,
        )
        if approval_result.get("action") != "approved" and next_node_id is None:
            return self._fail(
                db=db,
                execution=execution,
                state=state,
                events=events,
                error="Approval was rejected; workflow stopped before downstream nodes.",
            )
        return self._run_from(
            db=db,
            workflow_def=workflow_def,
            execution=execution,
            state=state,
            current_node_id=next_node_id,
            events=events,
        )

    def _run_from(
        self,
        *,
        db: Session,
        workflow_def: Dict[str, Any],
        execution: Execution,
        state: Dict[str, Any],
        current_node_id: Optional[str],
        events: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        workflow_id = execution.workflow_id
        execution_id = execution.id
        nodes = workflow_def.get("nodes", [])
        edges = workflow_def.get("edges", [])
        node_map = self._node_map(nodes)

        while current_node_id:
            node = node_map.get(current_node_id)
            if not node:
                return self._fail(
                    db=db,
                    execution=execution,
                    state=state,
                    events=events,
                    error=f"Node '{current_node_id}' was not found.",
                )

            node_type = node.get("type", "unknown")
            events.append(
                self._event(
                    "node.started",
                    workflow_id=workflow_id,
                    execution_id=execution_id,
                    node_id=current_node_id,
                    node_type=node_type,
                )
            )
            execution.current_node = current_node_id

            if node_type == "approval":
                return self._pause_for_approval(
                    db=db,
                    workflow_def=workflow_def,
                    execution=execution,
                    state=state,
                    node=node,
                    events=events,
                )

            result = self._execute_node(node, state)
            state["node_outputs"][current_node_id] = result
            state["last_result"] = result
            state["history"].append(
                {
                    "node_id": current_node_id,
                    "type": node_type,
                    "label": self._node_label(node),
                    "status": "success",
                    "result": result,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            events.append(
                self._event(
                    "node.completed",
                    workflow_id=workflow_id,
                    execution_id=execution_id,
                    node_id=current_node_id,
                    node_type=node_type,
                    result=result,
                )
            )

            if node_type == "end":
                final_output = self._final_output(state)
                execution.status = "completed"
                execution.current_node = None
                execution.output_data = final_output
                execution.completed_at = datetime.now(timezone.utc)
                db.commit()
                events.append(
                    self._event(
                        "workflow.completed",
                        workflow_id=workflow_id,
                        execution_id=execution_id,
                        result=final_output,
                    )
                )
                return {
                    "execution_backend": "local",
                    "status": "completed",
                    "events": events,
                    "output": final_output,
                }

            current_node_id = self._get_next_node_id(node, edges, result)

        final_output = self._final_output(state)
        execution.status = "completed"
        execution.current_node = None
        execution.output_data = final_output
        execution.completed_at = datetime.now(timezone.utc)
        db.commit()
        events.append(
            self._event(
                "workflow.completed",
                workflow_id=workflow_id,
                execution_id=execution_id,
                result=final_output,
            )
        )
        return {
            "execution_backend": "local",
            "status": "completed",
            "events": events,
            "output": final_output,
        }

    def _pause_for_approval(
        self,
        *,
        db: Session,
        workflow_def: Dict[str, Any],
        execution: Execution,
        state: Dict[str, Any],
        node: Dict[str, Any],
        events: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        node_id = node.get("id")
        config = node.get("data", {}).get("config", {})
        approval_id = str(uuid4())
        approval_context = self._approval_context(state)
        pending_approval = {
            "id": approval_id,
            "execution_id": execution.id,
            "node_id": node_id,
            "title": config.get("name", "Approval Required"),
            "description": config.get("description")
            or config.get("message")
            or "Please review before the workflow continues.",
            "context": approval_context,
            "status": "pending",
            "requested_at": datetime.now(timezone.utc).isoformat(),
        }

        approval = ApprovalRequest(
            id=approval_id,
            execution_id=execution.id,
            node_id=node_id,
            status="pending",
            approval_data={
                "approval_type": "any",
                "total_approvers": 1,
                "responses": [],
                "title": pending_approval["title"],
                "description": pending_approval["description"],
                "context": pending_approval["context"],
            },
            requested_at=datetime.now(timezone.utc),
        )
        state["paused_node_id"] = node_id
        state["approval_id"] = approval_id
        state["workflow_def_snapshot"] = workflow_def

        execution.status = "waiting_approval"
        execution.current_node = node_id
        execution.output_data = {"local_state": state}
        db.add(approval)
        db.commit()

        events.append(
            self._event(
                "approval.requested",
                workflow_id=execution.workflow_id,
                execution_id=execution.id,
                node_id=node_id,
                node_type="approval",
                result=None,
                extra={
                    "approval_id": approval_id,
                    "title": pending_approval["title"],
                    "description": pending_approval["description"],
                    "context": pending_approval["context"],
                },
            )
        )

        return {
            "execution_backend": "local",
            "status": "waiting_approval",
            "events": events,
            "output": None,
            "pending_approval": pending_approval,
        }

    def _execute_node(self, node: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        node_type = node.get("type")
        config = node.get("data", {}).get("config", {})
        label = self._node_label(node)
        previous = state.get("last_result") or state.get("input") or {}

        if node_type == "trigger":
            input_payload = state.get("input", {}) or {}
            input_text = (
                input_payload.get("input_text")
                or input_payload.get("document_text")
                or config.get("input_text")
                or ""
            )
            return {
                "input_text": input_text,
                "input_json": config.get("input_json") or input_payload,
                "source_name": input_payload.get("source_name")
                or (
                    "pasted diligence notes"
                    if state.get("is_diligence_template")
                    else "pasted source material"
                ),
                "source": "local-demo",
            }
        if node_type == "agent":
            return self._agent_result(label, config, previous, state)
        if node_type == "eval":
            if state.get("is_diligence_template"):
                return {
                    "passed": True,
                    "score": 0.88,
                    "reason": "Claims, risk flags, and approval context are present.",
                    "data": {
                        "checks": [
                            "material claims extracted",
                            "risks classified",
                            "human approval required before memo generation",
                        ]
                    },
                    "cost": 0.0012,
                    "latency_ms": 260,
                }
            return {
                "passed": True,
                "score": 0.9,
                "reason": "Output satisfies the configured evaluation criteria.",
                "data": {
                    "checks": [
                        "required output present",
                        "local evaluation completed",
                    ]
                },
                "cost": 0.0012,
                "latency_ms": 260,
            }
        if node_type == "conditional":
            return {"status": "condition evaluated", "input": previous}
        if node_type == "timer":
            return {
                "waited_seconds": config.get("duration_seconds", 0),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        if node_type == "api_call":
            return {
                "status_code": 200,
                "body": {"message": "Local demo skipped external API call."},
                "headers": {},
                "response_time_ms": 80,
            }
        if node_type == "event":
            return {
                "operation": config.get("operation", "publish"),
                "channel": config.get("channel", "local-demo"),
                "status": "simulated",
            }
        if node_type == "merge":
            return {"merged_results": list(state.get("node_outputs", {}).values())}
        if node_type == "end":
            return {"status": "workflow end", "captured": previous}

        return {"output": f"Local demo executed {label}.", "node_type": node_type}

    def _agent_result(
        self,
        label: str,
        config: Dict[str, Any],
        previous: Any,
        state: Dict[str, Any],
    ) -> Dict[str, Any]:
        is_diligence_template = bool(state.get("is_diligence_template"))
        lower = f"{label} {config.get('name', '')}".lower()
        if "extract" in lower or "claim" in lower or "risk" in lower:
            source_text = self._source_text(previous)
            claims = self._extract_claims(source_text)
            risks = self._extract_risks(source_text)
            assumptions = self._extract_assumptions(source_text)
            if not is_diligence_template:
                return {
                    "output": (
                        f"Extracted {len(claims)} candidate items, {len(risks)} "
                        f"review signals, and {len(assumptions)} assumptions."
                    ),
                    "source_excerpt": source_text[:360],
                    "claims": claims,
                    "risks": risks,
                    "assumptions": assumptions,
                    "model": "local-demo/extraction-agent",
                    "cost": 0.0042,
                    "usage": {
                        "prompt_tokens": 1180,
                        "completion_tokens": 420,
                        "total_tokens": 1600,
                    },
                    "latency_ms": 840,
                }
            return {
                "output": (
                    f"Extracted {len(claims)} diligence claims, {len(risks)} "
                    f"material risks, and {len(assumptions)} assumptions "
                    "requiring reviewer confirmation."
                ),
                "source_excerpt": source_text[:360],
                "claims": claims,
                "risks": risks,
                "assumptions": assumptions,
                "model": "local-demo/diligence-analyst",
                "cost": 0.0042,
                "usage": {"prompt_tokens": 1180, "completion_tokens": 420, "total_tokens": 1600},
                "latency_ms": 840,
            }
        if "memo" in lower or "ic" in lower or "investment" in lower:
            if not is_diligence_template:
                return {
                    "output": (
                        "Generated a concise draft from the approved workflow "
                        "context and captured execution metadata."
                    ),
                    "memo": {
                        "recommendation": "Review the draft and route it to the next step.",
                        "key_points": [
                            "Prior node output was summarized.",
                            "Human approval context was included when present.",
                            "Execution metadata was preserved for review.",
                        ],
                        "approval_note": "Reviewer decision was included before draft generation.",
                    },
                    "model": "local-demo/writer",
                    "cost": 0.0031,
                    "usage": {
                        "prompt_tokens": 940,
                        "completion_tokens": 360,
                        "total_tokens": 1300,
                    },
                    "latency_ms": 710,
                }
            return {
                "output": (
                    "IC memo draft: The company shows strong growth and credible "
                    "enterprise demand, but diligence should focus on account "
                    "concentration, retention cohort quality, and whether AI-driven "
                    "expansion produces durable gross margin."
                ),
                "memo": {
                    "recommendation": "Proceed to partner review with focused follow-up.",
                    "key_points": [
                        "Growth is strong, but buyer concentration needs validation.",
                        "Retention should be verified by cohort and contract type.",
                        "AI automation economics need usage-based margin evidence.",
                    ],
                    "approval_note": "Human reviewer approved the risk framing before memo generation.",
                },
                "model": "local-demo/ic-memo-writer",
                "cost": 0.0031,
                "usage": {"prompt_tokens": 940, "completion_tokens": 360, "total_tokens": 1300},
                "latency_ms": 710,
            }
        return {
            "output": f"Local demo response for {label}. Input was summarized successfully.",
            "input_summary": str(previous)[:240],
            "model": "local-demo/general-agent",
            "cost": 0.001,
            "usage": {"prompt_tokens": 300, "completion_tokens": 120, "total_tokens": 420},
            "latency_ms": 320,
        }

    def _source_text(self, previous: Any) -> str:
        if isinstance(previous, dict):
            return (
                str(previous.get("input_text") or "")
                or str(previous.get("document_text") or "")
                or str(previous.get("content") or "")
            ).strip()
        return str(previous or "").strip()

    def _extract_claims(self, source_text: str) -> List[Dict[str, str]]:
        defaults = [
            {"claim": "Revenue grew 42% YoY", "source": "management memo"},
            {"claim": "Gross retention is above 90%", "source": "KPI appendix"},
            {"claim": "Enterprise pipeline is concentrated in 6 accounts", "source": "sales notes"},
            {"claim": "AI automation is the primary expansion driver", "source": "strategy section"},
        ]
        if not source_text:
            return defaults

        sentences = self._sentences(source_text)
        claim_keywords = [
            "%",
            "revenue",
            "retention",
            "margin",
            "pipeline",
            "growth",
            "arr",
            "ebitda",
            "customer",
        ]
        claims = [
            {"claim": sentence, "source": "uploaded memo"}
            for sentence in sentences
            if any(keyword in sentence.lower() for keyword in claim_keywords)
        ]
        return claims[:5] or [{"claim": sentences[0], "source": "uploaded memo"}]

    def _extract_risks(self, source_text: str) -> List[Dict[str, str]]:
        defaults = [
            {
                "risk": "Customer concentration",
                "severity": "high",
                "rationale": "Six accounts drive most expansion pipeline.",
            },
            {
                "risk": "Unverified retention quality",
                "severity": "medium",
                "rationale": "Retention claim needs cohort-level evidence.",
            },
        ]
        if not source_text:
            return defaults

        risk_map = [
            ("concentration", "Customer concentration", "high"),
            ("churn", "Retention durability", "high"),
            ("retention", "Retention quality needs validation", "medium"),
            ("margin", "Margin assumptions need support", "medium"),
            ("pipeline", "Pipeline conversion risk", "medium"),
            ("competition", "Competitive pressure", "medium"),
            ("debt", "Capital structure risk", "high"),
            ("regulatory", "Regulatory exposure", "high"),
        ]
        lowered = source_text.lower()
        risks = [
            {
                "risk": title,
                "severity": severity,
                "rationale": f"Source material references {keyword}; reviewer should verify evidence.",
            }
            for keyword, title, severity in risk_map
            if keyword in lowered
        ]
        return risks[:4] or [
            {
                "risk": "Evidence completeness",
                "severity": "medium",
                "rationale": "The memo needs supporting source documents before IC circulation.",
            }
        ]

    def _extract_assumptions(self, source_text: str) -> List[str]:
        defaults = [
            "Pipeline conversion remains near current rates.",
            "Gross retention excludes one-time services.",
            "AI automation margin profile scales with usage.",
        ]
        if not source_text:
            return defaults

        sentences = self._sentences(source_text)
        assumption_keywords = ["expected", "assume", "projected", "forecast", "should", "will"]
        assumptions = [
            sentence
            for sentence in sentences
            if any(keyword in sentence.lower() for keyword in assumption_keywords)
        ]
        return assumptions[:4] or ["Management assumptions should be verified against source documents."]

    def _sentences(self, source_text: str) -> List[str]:
        normalized = source_text.replace("\n", " ")
        chunks = []
        for part in normalized.split("."):
            sentence = part.strip(" -\t")
            if sentence:
                chunks.append(sentence if sentence.endswith(".") else f"{sentence}.")
        return chunks[:12] or [source_text[:240]]

    def _final_output(self, state: Dict[str, Any]) -> Dict[str, Any]:
        outputs = state.get("node_outputs", {})
        history = state.get("history", [])
        total_cost = round(
            sum(
                value.get("cost", 0)
                for value in outputs.values()
                if isinstance(value, dict)
            ),
            6,
        )
        total_latency = sum(
            value.get("latency_ms", 0)
            for value in outputs.values()
            if isinstance(value, dict)
        )
        final_agent = next(
            (
                item["result"]
                for item in reversed(history)
                if item.get("type") == "agent" and isinstance(item.get("result"), dict)
            ),
            state.get("last_result"),
        )
        approval = next(
            (
                item["result"]
                for item in history
                if item.get("type") == "approval" and isinstance(item.get("result"), dict)
            ),
            None,
        )
        eval_result = next(
            (
                item["result"]
                for item in history
                if item.get("type") == "eval" and isinstance(item.get("result"), dict)
            ),
            None,
        )
        return {
            "summary": "Local workflow completed with execution metadata.",
            "final_result": final_agent,
            "audit": {
                "execution_id": state.get("execution_id"),
                "approval": approval,
                "eval_score": eval_result.get("score") if eval_result else None,
                "total_cost": total_cost,
                "total_latency_ms": total_latency,
                "nodes_executed": len(history),
            },
            "node_outputs": outputs,
        }

    def _fail(
        self,
        *,
        db: Session,
        execution: Execution,
        state: Dict[str, Any],
        events: List[Dict[str, Any]],
        error: str,
    ) -> Dict[str, Any]:
        failed_output = self._final_output(state)
        failed_output["summary"] = "Local workflow failed with execution metadata."
        failed_output["error"] = error
        failed_output["final_result"] = {"error": error}
        failed_output["local_state"] = state

        execution.status = "failed"
        execution.error = error
        execution.output_data = failed_output
        execution.completed_at = datetime.now(timezone.utc)
        db.commit()
        events.append(
            self._event(
                "workflow.failed",
                workflow_id=execution.workflow_id,
                execution_id=execution.id,
                error=error,
            )
        )
        return {
            "execution_backend": "local",
            "status": "failed",
            "events": events,
            "output": failed_output,
        }

    def _get_next_node_id(
        self,
        current_node: Dict[str, Any],
        edges: List[Dict[str, Any]],
        result: Any,
    ) -> Optional[str]:
        current_id = current_node.get("id")
        node_type = current_node.get("type")

        if node_type == "approval":
            handle_id = "approve" if result.get("action") == "approved" else "reject"
            edge = next(
                (
                    item
                    for item in edges
                    if item.get("source") == current_id and item.get("sourceHandle") == handle_id
                ),
                None,
            )
            if edge:
                return edge.get("target")
            if result.get("action") == "approved":
                generic_edge = next(
                    (
                        item
                        for item in edges
                        if item.get("source") == current_id
                        and not item.get("sourceHandle")
                    ),
                    None,
                )
                return generic_edge.get("target") if generic_edge else None
            return None

        if node_type == "conditional":
            expression = current_node.get("data", {}).get("config", {}).get("condition_expression", "False")
            outcome = self._evaluate_condition(expression, result)
            handle_id = "true" if outcome else "false"
            edge = next(
                (
                    item
                    for item in edges
                    if item.get("source") == current_id and item.get("sourceHandle") == handle_id
                ),
                None,
            )
            if edge:
                return edge.get("target")

        outgoing_edges = [item for item in edges if item.get("source") == current_id]
        return outgoing_edges[0].get("target") if outgoing_edges else None

    def _evaluate_condition(self, expression: str, current_result: Any) -> bool:
        safe_builtins = {
            "True": True,
            "False": False,
            "None": None,
            "len": len,
            "str": str,
            "int": int,
            "float": float,
            "list": list,
            "dict": dict,
            "any": any,
            "all": all,
        }
        try:
            return bool(eval(expression, {"__builtins__": safe_builtins}, {"output": current_result}))
        except Exception:
            return False

    def _approval_context(self, state: Dict[str, Any]) -> Dict[str, Any]:
        node_outputs = state.get("node_outputs", {})
        output_values = [
            value for value in node_outputs.values() if isinstance(value, dict)
        ]
        analysis = next(
            (
                value
                for value in reversed(output_values)
                if "claims" in value or "risks" in value or "assumptions" in value
            ),
            {},
        )
        eval_result = next(
            (value for value in reversed(output_values) if "score" in value),
            {},
        )
        fallback = state.get("last_result")

        if analysis:
            return {
                "content": analysis.get("output") or analysis,
                "source_excerpt": analysis.get("source_excerpt"),
                "claims": analysis.get("claims", []),
                "risks": analysis.get("risks", []),
                "assumptions": analysis.get("assumptions", []),
                "eval_score": eval_result.get("score"),
                "eval_reason": eval_result.get("reason"),
                "cost": analysis.get("cost"),
                "model": analysis.get("model"),
            }

        if isinstance(fallback, dict):
            return {
                "content": fallback.get("output") or fallback,
                "claims": fallback.get("claims", []),
                "risks": fallback.get("risks", []),
                "cost": fallback.get("cost"),
                "model": fallback.get("model"),
            }
        return {"content": fallback}

    def _event(
        self,
        event_type: str,
        *,
        workflow_id: str,
        execution_id: str,
        node_id: Optional[str] = None,
        node_type: Optional[str] = None,
        result: Optional[Any] = None,
        error: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "workflow_id": workflow_id,
            "execution_id": execution_id,
            "node_id": node_id,
            "node_type": node_type,
            "result": result,
            "error": error,
        }
        if extra:
            data.update(extra)
        return {
            "event_type": event_type,
            "data": data,
            "timestamp": str(time.time()),
        }

    def _node_map(self, nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        return {node.get("id"): node for node in nodes if node.get("id")}

    def _find_start_node_id(self, nodes: List[Dict[str, Any]]) -> Optional[str]:
        for node in nodes:
            if node.get("type") == "trigger":
                return node.get("id")
        return nodes[0].get("id") if nodes else None

    def _node_label(self, node: Dict[str, Any]) -> str:
        return (
            node.get("data", {}).get("label")
            or node.get("data", {}).get("config", {}).get("name")
            or node.get("id")
            or "Unnamed Node"
        )
