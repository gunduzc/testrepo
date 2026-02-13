# API Documentation

All API routes are under `/api/`. Authentication is required for most endpoints.
Responses follow the format: `{ success: boolean, data?: T, error?: { code: string, message: string } }`

## Authentication

### POST /api/auth/register
Create a new user account.

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string (min 8 chars)",
  "role": "STUDENT" | "EDUCATOR" (optional, default: STUDENT)
}
```

**Response:** User object (201)

### POST /api/auth/[...nextauth]
NextAuth endpoints for sign in/out.

### POST /api/auth/2fa
Two-factor authentication management.

**Body (enable):**
```json
{ "action": "enable" }
```
**Response:** QR code, secret, backup codes

**Body (verify):**
```json
{ "action": "verify", "code": "6-digit code" }
```

**Body (disable):**
```json
{ "action": "disable", "code": "6-digit code" }
```

---

## Study

### GET /api/study/:curriculumId
Get next question for study session.

**Response:**
```json
{
  "sessionId": "string",
  "cardId": "string",
  "question": "string (markdown)",
  "answerType": "INTEGER" | "DECIMAL" | "TEXT" | "FRACTION" | "CHOICE",
  "choices": ["string"] | undefined,
  "cardName": "string",
  "subjectName": "string"
}
```
Returns `null` with `nextDue` date if no cards due.

### POST /api/study/submit
Submit answer for validation.

**Body:**
```json
{
  "sessionId": "string",
  "answer": "string"
}
```

**Response:**
```json
{
  "correct": boolean,
  "correctAnswer": "string",
  "rating": "AGAIN" | "HARD" | "GOOD" | "EASY",
  "progress": { ... },
  "nextState": "NEW" | "LEARNING" | "REVIEW" | "RELEARNING"
}
```

---

## Cards

### POST /api/cards
Create a new card. **Roles: ADMIN, EDUCATOR**

**Body:**
```json
{
  "functionSource": "string (JavaScript)",
  "name": "string",
  "description": "string",
  "answerType": "INTEGER" | "DECIMAL" | "TEXT" | "FRACTION" | "CHOICE",
  "learningSteps": 5,
  "relearningSteps": 3,
  "tags": ["string"],
  "subjectId": "string (optional)",
  "position": 0
}
```

### GET /api/cards
List cards by author.

**Query:** `limit`, `offset`, `search`

### GET /api/cards/:id
Get card by ID.

### PUT /api/cards/:id
Update card. **Roles: ADMIN, EDUCATOR**

### DELETE /api/cards/:id
Delete card. **Roles: ADMIN, EDUCATOR**

### POST /api/cards/test
Test card function without saving.

**Body:**
```json
{
  "source": "string (JavaScript)",
  "count": 10
}
```

**Response:** Array of SandboxResult

---

## Curricula

### POST /api/curricula
Create curriculum. **Roles: ADMIN, EDUCATOR**

**Body:**
```json
{
  "name": "string",
  "description": "string",
  "isPublic": false
}
```

### GET /api/curricula
List curricula by author.

### GET /api/curricula/public
List public curricula.

**Query:** `limit`, `offset`, `search`

### GET /api/curricula/:id
Get curriculum with full structure (subjects, cards, prerequisites).

### PUT /api/curricula/:id
Update curriculum metadata.

### DELETE /api/curricula/:id
Delete curriculum.

### POST /api/curricula/:id/subjects
Add subject to curriculum.

**Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

### POST /api/curricula/:id/enroll
Enroll current user in public curriculum.

---

## Subjects

### PUT /api/subjects/:id
Update subject / reorder cards.

**Body:**
```json
{
  "name": "string",
  "description": "string",
  "cardIds": ["string"] // for reordering
}
```

### POST /api/subjects/:id/prerequisites
Add prerequisite relationship. Validates no cycle.

**Body:**
```json
{ "prerequisiteId": "string" }
```

### DELETE /api/subjects/:id/prerequisites
Remove prerequisite.

**Query:** `prerequisiteId`

---

## LLM

### POST /api/llm/generate
Generate card function from description.

**Body:**
```json
{ "description": "string (10-1000 chars)" }
```

**Response:**
```json
{ "source": "string (JavaScript)" }
```

### POST /api/llm/revise
Revise function based on flagged samples.

**Body:**
```json
{
  "source": "string",
  "flaggedSamples": [{
    "sampleIndex": 0,
    "generatedQuestion": "string",
    "generatedAnswer": "string",
    "correctedAnswer": "string",
    "comment": "string"
  }]
}
```

---

## Import/Export

### GET /api/export
Export card, subject, or curriculum as JSON.

**Query:** `type` (card|subject|curriculum), `id`

### POST /api/import
Import content.

**Body:**
```json
{
  "type": "card" | "subject" | "curriculum",
  "data": { ... },
  "subjectId": "string (for card)",
  "position": 0 (for card),
  "curriculumId": "string (for subject)"
}
```

---

## Optimization

### POST /api/optimization/run
Trigger global FSRS parameter optimization. **Role: ADMIN**

### GET /api/optimization/status
Get optimization status.

---

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Not authenticated |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Invalid input |
| INVALID_CARD | Card function failed validation |
| DAG_CYCLE | Prerequisite would create cycle |
| SESSION_NOT_FOUND | Study session expired or not found |
| SERVICE_UNAVAILABLE | External service not configured |
