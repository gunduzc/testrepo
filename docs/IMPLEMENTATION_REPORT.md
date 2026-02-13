# Implementation Report: Programmable Spaced Repetition Learning Platform

**Date:** February 12, 2026
**Status:** Core functionality working, UI incomplete

---

## 1. Executive Summary

The platform implements programmable flashcards with spaced repetition scheduling. Educators write JavaScript functions that generate infinite question variations, executed securely in V8 sandboxes. Students study with FSRS-based scheduling that adapts to their performance.

**Current state:** The core study loop works end-to-end. A student can enroll in a curriculum, answer dynamically generated questions, and have their progress tracked with FSRS scheduling.

---

## 2. What Was Built

### 2.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Database | SQLite via Prisma ORM |
| Auth | NextAuth.js with credentials provider |
| Scheduling | ts-fsrs (FSRS-5 algorithm) |
| Sandbox | isolated-vm (V8 isolates) |
| UI | React, Tailwind CSS, NextUI |

### 2.2 Database Schema

Complete Prisma schema implementing the LLD data model:

```
prisma/schema.prisma
```

**Models implemented:**
- `User` - Authentication, roles (ADMIN/EDUCATOR/STUDENT), FSRS parameters
- `Card` - JavaScript function source, answer type, learning steps
- `Subject` - Topic containers for cards with ordering
- `Curriculum` - DAG of subjects with prerequisites
- `StudentCardState` - Per-user FSRS state for each card
- `ReviewLog` - Immutable review history for analytics
- `ActiveStudySession` - Server-side answer storage (security)
- `Class`, `ClassEnrollment`, `CurriculumAssignment` - Organization
- `Theme`, `GeneratedContent` - LLM theming (schema only)
- `CardAuthoringHistory` - LLM provenance (schema only)

### 2.3 Core Services

#### SandboxService (`src/services/sandbox.service.ts`)

Executes card JavaScript in isolated V8 instances.

```typescript
// Key implementation
const isolate = new ivm.Isolate({ memoryLimit: 8 }); // 8MB limit
const context = await isolate.createContext();

// Expose only Math.random via callback
await jail.set("_getRandomNumber", new ivm.Callback(() => Math.random()));

// Execute with timeout
const script = await isolate.compileScript(wrappedSource);
const resultJson = await script.run(context, { timeout: 1000 }); // 1s limit
```

**Security features:**
- Fresh isolate per execution
- 8MB memory limit
- 1 second timeout
- No filesystem/network access
- Only Math functions exposed

#### FSRSService (`src/services/fsrs.service.ts`)

Wraps ts-fsrs for spaced repetition scheduling.

**Methods:**
- `getNextCard(userId, curriculumId)` - Selects due card respecting prerequisites
- `updateCardState(userId, cardId, rating)` - Applies FSRS algorithm
- `computeRating(correct, responseTimeMs)` - Maps response to AGAIN/HARD/GOOD/EASY

**Prerequisite enforcement:**
- Subjects form a DAG via `SubjectPrerequisite`
- A subject unlocks when 80% of prerequisite subject cards reach REVIEW state with stability > 10

#### StudyService (`src/services/study.service.ts`)

Orchestrates the study session flow.

**Flow:**
1. `getNextQuestion()` - Select card → Execute in sandbox → Store answer server-side → Return question only
2. `submitAnswer()` - Validate → Compute rating → Update FSRS state → Log review

#### ValidationService (`src/services/validation.service.ts`)

Type-based answer normalization:
- `INTEGER`: Parse, ignore leading zeros
- `DECIMAL`: Float comparison with epsilon
- `TEXT`: Trim, case-insensitive
- `FRACTION`: Reduce to lowest terms
- `CHOICE`: Exact match

#### CurriculumService (`src/services/curriculum.service.ts`)

Curriculum and subject management with DAG validation (Kahn's algorithm for cycle detection).

### 2.4 API Routes

| Route | Method | Status | Description |
|-------|--------|--------|-------------|
| `/api/auth/register` | POST | ✅ | User registration |
| `/api/auth/[...nextauth]` | * | ✅ | NextAuth handlers |
| `/api/study/[curriculumId]` | GET | ✅ | Get next question |
| `/api/study/submit` | POST | ✅ | Submit answer |
| `/api/curricula/public` | GET | ✅ | List public curricula |
| `/api/curricula` | POST | ✅ | Enroll in curriculum |

### 2.5 UI Pages

| Page | Status | Description |
|------|--------|-------------|
| `/` | ✅ | Landing page |
| `/login` | ✅ | Login form |
| `/register` | ✅ | Registration form |
| `/dashboard` | ✅ | Student dashboard (basic) |
| `/curricula` | ✅ | Curriculum browser |
| `/study/[curriculumId]` | ✅ | Study session view |

### 2.6 Example Card Functions

Cards are stored as JavaScript source code. Example from the test curriculum:

```javascript
// Simple Addition - generates random addition problems
function generate() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  return {
    question: "What is " + a + " + " + b + "?",
    answer: { correct: String(a + b), type: "INTEGER" }
  };
}
```

Each execution produces a different question (e.g., "What is 14 + 7?", "What is 3 + 19?").

---

## 3. Test Data

Created seed file (`prisma/seed.ts`) with:

- **Educator user:** `educator@test.com`
- **Curriculum:** "Basic Arithmetic" (public)
- **Subjects:**
  - Addition (no prerequisites)
  - Subtraction (requires Addition)
  - Multiplication (requires Addition)
- **Cards:** One card per subject

Run with: `npx prisma db seed`

---

## 4. Bugs Fixed During Testing

### 4.1 PrismaAdapter Type Mismatch
**Error:** `Type 'PrismaClient' is not assignable to parameter`
**Fix:** Cast to `PrismaClient as any` for NextAuth adapter compatibility

### 4.2 ZodError Property
**Error:** `Property 'errors' does not exist on type 'ZodError'`
**Fix:** Changed `.errors` to `.issues`

### 4.3 FSRS learning_steps Field
**Error:** `learning_steps does not exist on type FSRS`
**Fix:** Removed deprecated field reference

### 4.4 Card Function Name
**Error:** `Card must export a function named "generate"`
**Fix:** Renamed seed card functions from `generateQuestion` to `generate`

### 4.5 Math.random in Sandbox
**Error:** `Math.random is not a function`
**Fix:** Changed from `jail.set("_random", fn, { reference: true })` to `new ivm.Callback()`

### 4.6 Enrollment Unique Constraint
**Error:** `Unique constraint failed on userId_curriculumId`
**Fix:** Changed `prisma.userCurriculumEnrollment.create()` to `upsert()`

### 4.7 "All Caught Up" UX
**Issue:** Shows past due time when cards are actually due
**Fix:** Added logic to detect past-due cards and show "Cards Ready!" instead

---

## 5. What's NOT Implemented

### 5.1 Services

| Service | LLD Spec | Status |
|---------|----------|--------|
| FSRSOptimizationService | Native Rust optimizer | Stubbed (returns defaults) |
| LLMService | Card generation, theming | Not implemented |
| ImportExportService | JSON serialization | Not implemented |

### 5.2 API Routes

| Route Group | Status |
|-------------|--------|
| `/api/cards/*` | Partial (no test endpoint) |
| `/api/classes/*` | Not implemented |
| `/api/llm/*` | Not implemented |
| `/api/import-export/*` | Not implemented |
| `/api/optimization/*` | Not implemented |

### 5.3 UI Components

| Component | Status |
|-----------|--------|
| CardCodeEditor | No Monaco integration |
| CardLLMEditor | Not implemented |
| SubjectEditor | Not implemented |
| CurriculumEditor | No visual DAG editor |
| EducatorDashboard | Not implemented |

### 5.4 Features

- **2FA/TOTP** - Schema exists, not wired up
- **Theme selection** - Schema exists, no UI
- **Class management** - Schema exists, no UI
- **Card step overrides** - Schema exists, not used
- **Tests** - None written

---

## 6. Architecture Assessment

### 6.1 LLD Compliance

The implementation follows the LLD's layered architecture:

```
UX Layer (app/, components/)
    ↓ HTTP
API Routes (app/api/)
    ↓ calls
Core Layer (services/)
    ↓ queries
Data Layer (prisma/)
```

### 6.2 Deviations from LLD

| LLD Spec | Implementation | Reason |
|----------|----------------|--------|
| PostgreSQL | SQLite | Simpler for development |
| Monaco editor | None | Time constraints |
| Native FSRS optimizer | Stubbed | Package compatibility issues |

### 6.3 Architecture Strengths

1. **Security model** - Answers never sent to client, validated server-side
2. **Sandbox isolation** - Untrusted code runs in V8 isolates
3. **DAG prerequisites** - Structural difficulty progression
4. **FSRS integration** - Proven spaced repetition algorithm

---

## 7. How to Run

### 7.1 Prerequisites

- Node.js 20+
- npm

### 7.2 Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed test data
npx prisma db seed

# Start dev server
npm run dev
```

### 7.3 Test the Study Flow

1. Open `http://localhost:3000`
2. Click "Get Started" → Register an account
3. Go to "Browse Curricula"
4. Click "Start Learning" on "Basic Arithmetic"
5. Answer the addition questions

---

## 8. File Structure

```
/home/gunduzc/platform/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Test data
│   └── dev.db                 # SQLite database
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth routes
│   │   │   ├── study/         # Study session API
│   │   │   └── curricula/     # Curriculum API
│   │   ├── (auth)/            # Login, register pages
│   │   ├── dashboard/         # Student dashboard
│   │   ├── curricula/         # Curriculum browser
│   │   └── study/             # Study session page
│   ├── components/
│   │   ├── ui/                # NextUI components
│   │   └── study/             # Study view component
│   ├── services/
│   │   ├── sandbox.service.ts # V8 isolate execution
│   │   ├── fsrs.service.ts    # FSRS scheduling
│   │   ├── study.service.ts   # Study orchestration
│   │   ├── validation.service.ts
│   │   ├── curriculum.service.ts
│   │   └── optimization.service.ts (stubbed)
│   └── lib/
│       ├── auth.ts            # NextAuth config
│       ├── prisma.ts          # Prisma client
│       └── types/             # TypeScript types
├── docs/
│   └── IMPLEMENTATION_REPORT.md  # This file
└── LLD_Report.md              # Original specification
```

---

## 9. Next Steps (Priority Order)

1. **Card Editor** - Monaco integration for creating cards via UI
2. **Import/Export** - JSON serialization for sharing curricula
3. **FSRS Optimization** - Implement actual parameter optimization
4. **Class Management** - Educator dashboard and student management
5. **LLM Integration** - Card generation and theming
6. **Tests** - Unit and integration tests
7. **Production Database** - Migrate to PostgreSQL

---

## 10. Conclusion

The core platform functionality is implemented and working:
- Programmable flashcards execute in secure sandboxes
- FSRS scheduling adapts to student performance
- Prerequisite DAG enforces learning order
- Server-side answer validation prevents cheating

The main gaps are UI tooling (card editor, visual DAG editor) and advanced features (LLM, optimization). The architecture is solid and follows the LLD specification.
