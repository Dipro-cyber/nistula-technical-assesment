# Nistula Technical Assessment

A backend system that receives guest messages from multiple hospitality channels, normalises them into a unified schema, classifies the query type, sends it to the Claude API with property context, and returns a drafted reply with a confidence score and recommended action.

---

## Stack

- **Node.js + Express** — HTTP server and routing
- **dotenv** — environment variable management
- **uuid** — unique message ID generation
- **axios** — Claude API HTTP client
- **Claude claude-sonnet-4-20250514** — AI reply drafting

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Dipro-cyber/nistula-technical-assesment.git
cd nistula-technical-assesment
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=your_key_here
PORT=3000
```

### 4. Start the server

```bash
npm start
```

Server runs on `http://localhost:3000`

---

## API

### `POST /webhook/message`

Accepts a guest message from any supported channel and returns a drafted reply.

**Request body:**

```json
{
  "source": "whatsapp",
  "guest_name": "Rahul Sharma",
  "message": "Is the villa available from April 20 to 24?",
  "timestamp": "2026-05-05T10:30:00Z",
  "booking_ref": "NIS-2024-0891",
  "property_id": "villa-b1"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | `whatsapp`, `booking_com`, `airbnb`, `instagram`, `direct` |
| `guest_name` | Yes | Full name of the guest |
| `message` | Yes | The raw message text |
| `timestamp` | Yes | ISO 8601 datetime |
| `booking_ref` | No | Booking reference if available |
| `property_id` | Yes | Property identifier |

**Response:**

```json
{
  "message_id": "3219d443-fd4b-420e-8a18-f1fb0eb122a5",
  "query_type": "pre_sales_availability",
  "drafted_reply": "Hi Rahul, Yes, Villa B1 is available from April 20-24!...",
  "confidence_score": 1.0,
  "action": "auto_send"
}
```

### `GET /health`

Returns `{ "status": "ok" }` — use to confirm the server is running.

---

## Confidence Scoring Logic

Every drafted reply is scored between `0.0` and `1.0`. The score starts at `1.0` and deductions are applied based on risk factors:

| Condition | Deduction | Reason |
|-----------|-----------|--------|
| `query_type` is `complaint` | −0.15 | High-stakes message, needs human oversight |
| Message contains uncertain words (`maybe`, `not sure`, `unclear`, `perhaps`, `i think`) | −0.10 | Ambiguous intent reduces reply accuracy |
| `booking_ref` is missing | −0.10 | Unverified guest, less context available |
| `source` is `instagram` or `airbnb` | −0.05 | Informal channels, less structured messages |

Score is floored at `0.0` and rounded to 2 decimal places.

### Action thresholds

| Score | Action | Meaning |
|-------|--------|---------|
| > 0.85 | `auto_send` | High confidence — safe to send without review |
| 0.60 – 0.85 | `agent_review` | Moderate confidence — human should check before sending |
| < 0.60 or `complaint` | `escalate` | Low confidence or sensitive issue — requires human handling |

> Complaints always escalate regardless of score.

---

## Query Classification

Messages are classified into one of 6 types using keyword matching:

| Type | Example |
|------|---------|
| `pre_sales_availability` | "Is the villa free April 20-24?" |
| `pre_sales_pricing` | "What is the rate for 2 adults?" |
| `post_sales_checkin` | "What is the WiFi password?" |
| `special_request` | "Can you arrange airport pickup?" |
| `complaint` | "The AC is not working, this is unacceptable" |
| `general_enquiry` | "Are pets allowed?" |

---

## Sample Test Inputs

### Test 1 — Availability query (expect `auto_send`)

```bash
curl -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "source": "whatsapp",
    "guest_name": "Rahul Sharma",
    "message": "Is the villa available from April 20 to 24?",
    "timestamp": "2026-05-05T10:30:00Z",
    "booking_ref": "NIS-2024-0891",
    "property_id": "villa-b1"
  }'
```

Expected: `confidence_score: 1.0`, `action: "auto_send"`

---

### Test 2 — Complaint (expect `escalate`)

```bash
curl -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "source": "whatsapp",
    "guest_name": "Vikram Nair",
    "message": "The AC is not working, this is unacceptable!",
    "timestamp": "2026-05-05T14:00:00Z",
    "booking_ref": "NIS-2024-0032",
    "property_id": "villa-b1"
  }'
```

Expected: `query_type: "complaint"`, `action: "escalate"`

---

### Test 3 — Uncertain guest, no booking ref, informal channel (expect `agent_review`)

```bash
curl -X POST http://localhost:3000/webhook/message \
  -H "Content-Type: application/json" \
  -d '{
    "source": "airbnb",
    "guest_name": "Priya Nair",
    "message": "I think maybe I want to book, not sure about the dates yet",
    "timestamp": "2026-05-05T15:00:00Z",
    "property_id": "villa-b1"
  }'
```

Expected: `confidence_score: 0.75`, `action: "agent_review"`

---

## Project Structure

```
nistula-technical-assessment/
├── README.md
├── .env.example
├── schema.sql
├── thinking.md
└── src/
    ├── index.js                  — Express server, global error handlers
    ├── routes/
    │   └── webhook.js            — POST /webhook/message route
    ├── services/
    │   ├── claudeService.js      — Claude API integration
    │   └── classifier.js         — Query type classification
    └── utils/
        └── confidence.js         — Confidence scoring and action logic
```
