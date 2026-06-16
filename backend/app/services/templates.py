"""
Workflow Templates - Pre-built workflows matching frontend schema exactly
"""
from typing import List, Dict, Any
import uuid

def get_workflow_templates() -> List[Dict[str, Any]]:
    """Get all pre-built workflow templates with frontend-compatible schema"""

    diligence_trigger = "diligence-trigger"
    diligence_extract = "diligence-extract-claims"
    diligence_eval = "diligence-eval"
    diligence_approval = "diligence-approval"
    diligence_memo = "diligence-ic-memo"
    diligence_end = "diligence-end"

    diligence_template = {
        "id": "template-private-market-diligence",
        "name": "Private Market Diligence Review",
        "description": "Extract claims, flag risks, require human approval, and draft an IC memo with audit-ready execution metadata.",
        "is_template": True,
        "definition": {
            "nodes": [
                {
                    "id": diligence_trigger,
                    "type": "trigger",
                    "position": {"x": 32, "y": 260},
                    "data": {
                        "label": "Diligence Notes",
                        "type": "trigger",
                        "status": "idle",
                        "config": {
                            "name": "Diligence Notes",
                            "type": "manual",
                            "input_text": (
                                "Company memo: Revenue grew 42% YoY, gross retention is above 90%, "
                                "enterprise pipeline is concentrated in six accounts, and AI automation "
                                "is expected to drive expansion margin."
                            )
                        }
                    }
                },
                {
                    "id": diligence_extract,
                    "type": "agent",
                    "position": {"x": 260, "y": 260},
                    "data": {
                        "label": "Extract Claims & Risks",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Extract Claims & Risks",
                            "system_instructions": "Extract material claims, risks, assumptions, and missing evidence from private-market diligence notes.",
                            "temperature": 0.2,
                            "expected_output_format": "structured diligence findings",
                            "provider": "custom",
                            "agent_id": "local-diligence-analyst"
                        }
                    }
                },
                {
                    "id": diligence_eval,
                    "type": "eval",
                    "position": {"x": 488, "y": 260},
                    "data": {
                        "label": "Risk Completeness Eval",
                        "type": "eval",
                        "status": "idle",
                        "config": {
                            "name": "Risk Completeness Eval",
                            "eval_type": "policy",
                            "config": {
                                "policy_rules": [
                                    {"type": "confidence_threshold", "min_confidence": 0.75}
                                ]
                            },
                            "on_failure": "warn"
                        }
                    }
                },
                {
                    "id": diligence_approval,
                    "type": "approval",
                    "position": {"x": 716, "y": 260},
                    "data": {
                        "label": "Partner Review",
                        "type": "approval",
                        "status": "idle",
                        "config": {
                            "name": "Partner Review",
                            "description": "Review flagged diligence risks before generating the IC memo section.",
                            "approver_email": "partner-review@syncflow.local"
                        }
                    }
                },
                {
                    "id": diligence_memo,
                    "type": "agent",
                    "position": {"x": 944, "y": 260},
                    "data": {
                        "label": "Draft IC Memo",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Draft IC Memo",
                            "system_instructions": "Write a concise investment committee memo section from approved diligence findings.",
                            "temperature": 0.3,
                            "expected_output_format": "IC memo bullets",
                            "provider": "custom",
                            "agent_id": "local-ic-memo-writer"
                        }
                    }
                },
                {
                    "id": diligence_end,
                    "type": "end",
                    "position": {"x": 1172, "y": 260},
                    "data": {
                        "label": "Audit-Ready Memo",
                        "type": "end",
                        "status": "idle",
                        "config": {
                            "name": "Audit-Ready Memo",
                            "capture_output": True,
                            "show_output": True
                        }
                    }
                }
            ],
            "edges": [
                {"id": "d1", "source": diligence_trigger, "target": diligence_extract},
                {"id": "d2", "source": diligence_extract, "target": diligence_eval},
                {"id": "d3", "source": diligence_eval, "target": diligence_approval},
                {"id": "d4", "source": diligence_approval, "target": diligence_memo, "sourceHandle": "approve"},
                {"id": "d5", "source": diligence_memo, "target": diligence_end}
            ]
        }
    }
    
    # Template 1: Simple Sentiment Analysis
    t1_id = "template-sentiment-analysis"
    t1_trigger = str(uuid.uuid4())
    t1_agent = str(uuid.uuid4())
    t1_end = str(uuid.uuid4())
    
    template1 = {
        "id": t1_id,
        "name": "Sentiment Analysis Pipeline",
        "description": "Analyze customer feedback sentiment using OpenAI GPT-4",
        "is_template": True,
        "definition": {
            "nodes": [
                {
                    "id": t1_trigger,
                    "type": "trigger",
                    "position": {"x": 100, "y": 200},
                    "data": {
                        "label": "Customer Feedback",
                        "type": "trigger",
                        "status": "idle",
                        "config": {
                            "name": "Customer Feedback",
                            "type": "manual",
                            "input_text": "The product is great but delivery was slow"
                        }
                    }
                },
                {
                    "id": t1_agent,
                    "type": "agent",
                    "position": {"x": 400, "y": 200},
                    "data": {
                        "label": "Sentiment Analyzer",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Sentiment Analyzer",
                            "system_instructions": "Analyze the sentiment of the text and respond with: positive, negative, or neutral. Nothing else.",
                            "temperature": 0.3,
                            "expected_output_format": "text"
                        }
                    }
                },
                {
                    "id": t1_end,
                    "type": "end",
                    "position": {"x": 700, "y": 200},
                    "data": {
                        "label": "Result",
                        "type": "end",
                        "status": "idle",
                        "config": {
                            "name": "Sentiment Result",
                            "capture_output": True,
                            "show_output": True
                        }
                    }
                }
            ],
            "edges": [
                {"id": f"e1", "source": t1_trigger, "target": t1_agent},
                {"id": f"e2", "source": t1_agent, "target": t1_end}
            ]
        }
    }
    
    # Template 2: Multi-Agent Research
    t2_id = "template-multi-agent-research"
    t2_trigger = str(uuid.uuid4())
    t2_researcher = str(uuid.uuid4())
    t2_analyst = str(uuid.uuid4())
    t2_writer = str(uuid.uuid4())
    t2_end = str(uuid.uuid4())
    
    template2 = {
        "id": t2_id,
        "name": "Multi-Agent Research Team",
        "description": "Three AI agents collaborate on research: Researcher, Analyst, Writer",
        "is_template": True,
        "definition": {
            "nodes": [
                {
                    "id": t2_trigger,
                    "type": "trigger",
                    "position": {"x": 100, "y": 250},
                    "data": {
                        "label": "Research Topic",
                        "type": "trigger",
                        "status": "idle",
                        "config": {
                            "name": "Research Topic",
                            "type": "manual",
                            "input_text": "AI in healthcare"
                        }
                    }
                },
                {
                    "id": t2_researcher,
                    "type": "agent",
                    "position": {"x": 300, "y": 250},
                    "data": {
                        "label": "Researcher",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Research Agent",
                            "system_instructions": "You are a researcher. Provide 3-4 key facts about the topic. Be concise.",
                            "temperature": 0.5,
                            "expected_output_format": "text"
                        }
                    }
                },
                {
                    "id": t2_analyst,
                    "type": "agent",
                    "position": {"x": 500, "y": 250},
                    "data": {
                        "label": "Analyst",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Analysis Agent",
                            "system_instructions": "You are an analyst. Given research findings, identify 2-3 key insights and trends.",
                            "temperature": 0.6,
                            "expected_output_format": "text"
                        }
                    }
                },
                {
                    "id": t2_writer,
                    "type": "agent",
                    "position": {"x": 700, "y": 250},
                    "data": {
                        "label": "Writer",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Writer Agent",
                            "system_instructions": "You are a writer. Create a clear executive summary (150 words max) from the research and analysis.",
                            "temperature": 0.7,
                            "expected_output_format": "text"
                        }
                    }
                },
                {
                    "id": t2_end,
                    "type": "end",
                    "position": {"x": 900, "y": 250},
                    "data": {
                        "label": "Final Report",
                        "type": "end",
                        "status": "idle",
                        "config": {
                            "name": "Research Report",
                            "capture_output": True,
                            "show_output": True
                        }
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": t2_trigger, "target": t2_researcher},
                {"id": "e2", "source": t2_researcher, "target": t2_analyst},
                {"id": "e3", "source": t2_analyst, "target": t2_writer},
                {"id": "e4", "source": t2_writer, "target": t2_end}
            ]
        }
    }
    
    # Template 3: Content Moderation
    t3_id = "template-content-moderation"
    t3_trigger = str(uuid.uuid4())
    t3_moderator = str(uuid.uuid4())
    t3_approval = str(uuid.uuid4())
    t3_end = str(uuid.uuid4())
    
    template3 = {
        "id": t3_id,
        "name": "AI Content Moderation",
        "description": "AI screening with human approval for questionable content",
        "is_template": True,
        "definition": {
            "nodes": [
                {
                    "id": t3_trigger,
                    "type": "trigger",
                    "position": {"x": 100, "y": 250},
                    "data": {
                        "label": "User Content",
                        "type": "trigger",
                        "status": "idle",
                        "config": {
                            "name": "Content Input",
                            "type": "manual",
                            "input_text": "Check out this amazing product!"
                        }
                    }
                },
                {
                    "id": t3_moderator,
                    "type": "agent",
                    "position": {"x": 300, "y": 250},
                    "data": {
                        "label": "AI Moderator",
                        "type": "agent",
                        "status": "idle",
                        "config": {
                            "name": "Content Moderator",
                            "system_instructions": "Analyze content for spam or harmful content. Respond with: SAFE, QUESTIONABLE, or REJECT.",
                            "temperature": 0.2,
                            "expected_output_format": "text"
                        }
                    }
                },
                {
                    "id": t3_approval,
                    "type": "approval",
                    "position": {"x": 500, "y": 250},
                    "data": {
                        "label": "Human Review",
                        "type": "approval",
                        "status": "idle",
                        "config": {
                            "name": "Manual Review",
                            "message": "Content needs review",
                            "approver_email": "approvals@syncflow.local"
                        }
                    }
                },
                {
                    "id": t3_end,
                    "type": "end",
                    "position": {"x": 700, "y": 250},
                    "data": {
                        "label": "Result",
                        "type": "end",
                        "status": "idle",
                        "config": {
                            "name": "Moderation Result",
                            "capture_output": True,
                            "show_output": True
                        }
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": t3_trigger, "target": t3_moderator},
                {"id": "e2", "source": t3_moderator, "target": t3_approval},
                {"id": "e3", "source": t3_approval, "target": t3_end}
            ]
        }
    }
    
    return [diligence_template, template1, template2, template3]
