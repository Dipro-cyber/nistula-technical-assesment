# Thinking Questions — Nistula Technical Assessment

**Scenario:** It is 3am. A guest at Villa B1 sends a WhatsApp message:
*"There is no hot water and we have guests arriving for breakfast in 4 hours. This is unacceptable. I want a refund for tonight."*

---

## Question A — The Immediate Response

**The AI reply sent at 3am:**

> Hi [Guest Name], I'm so sorry — this is absolutely not acceptable and I completely understand your frustration. I'm alerting our caretaker right now to come to the villa and fix the hot water immediately. Someone will be with you within 30 minutes. Your concern about tonight's stay has been escalated to our team and we will follow up on the refund request first thing in the morning. Please stay on this chat — we are on it.

**Why this wording:**
The reply acknowledges the emotion first ("I'm so sorry", "completely understand") before moving to action — angry guests need to feel heard before they trust a resolution. It gives a concrete time commitment (30 minutes) rather than vague reassurance, which builds credibility at 3am. The refund is acknowledged but not promised outright — that decision needs a human — so it's deferred to morning without dismissing it.

---

## Question B — The System Response

Beyond sending the message, the platform does the following:

1. **Classifies and escalates** — query_type is set to `complaint`, confidence score drops to 0.85 or below, action is forced to `escalate` regardless of score.

2. **Notifies the caretaker** — an automated SMS or WhatsApp alert fires to the caretaker on duty with the villa name, guest name, issue summary, and timestamp.

3. **Notifies the property manager** — a push notification or SMS goes to the Nistula ops team with full context: guest name, booking ref, complaint text, and the AI reply that was sent.

4. **Logs to ai_logs** — the drafted reply, confidence score, query type, and action are written to the `ai_logs` table. `was_sent` is set to true, `agent_edited` is false (AI reply sent immediately given urgency).

5. **Opens an escalation ticket** — the conversation status in the `conversations` table is set to `escalated`. A 30-minute response timer starts.

6. **If no human responds within 30 minutes** — the system sends a follow-up message to the guest: *"Our team is on the way. If you haven't been contacted yet, please call [caretaker number] directly."* It also re-alerts the property manager with a "no response" flag and escalates to the next contact in the on-call chain.

---

## Question C — The Pattern and Prevention

**What the system should do with this pattern:**

The `ai_logs` table already stores query_type, property_id, and timestamps. A weekly pattern-detection job queries for complaints with keywords like "hot water" grouped by property_id. Three complaints of the same type within 60 days triggers a property health alert — a flag written to a `property_alerts` table and an email to the operations team.

**What I would build to prevent a fourth complaint:**

1. **Preventive maintenance checklist** — after each complaint is resolved, the system creates a maintenance task for the caretaker to inspect and test the hot water system before the next check-in. This is logged and must be marked complete.

2. **Pre-arrival property check** — 4 hours before every check-in, the caretaker runs a standard checklist (hot water, AC, WiFi, pool). Results are logged. If hot water fails the check, the guest is proactively messaged before they arrive.

3. **Supplier escalation** — after two complaints, the system flags the issue to the property owner with a recommendation to service or replace the water heater. The third complaint should never happen if the first two triggered action.

The goal is to move from reactive (fix it when a guest complains at 3am) to predictive (catch it before the guest ever notices).

---
*Total: ~390 words*
