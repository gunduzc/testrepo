# Implementation Report: Programmable Spaced Repetition Learning Platform

**Date:** February 12, 2026 (updated April 16, 2026)
**Status:** Feature-complete for senior project scope

---

## 1. Executive Summary

The platform implements programmable flashcards with spaced repetition scheduling. Educators write JavaScript functions that generate infinite question variations, executed securely in V8 sandboxes. Students study with FSRS-based scheduling that adapts to their performance.

**Current state:** The platform is feature-complete for senior project scope. Students study with FSRS scheduling, educators author cards with Monaco + LLM assistance, manage classes, and import/export curricula. 2FA, theme support, and tests are in place.

---

## 2. What Was Built

### 2.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Database | SQLite via Prisma ORM |
| Auth | NextAuth.js with credentials provider |
| Scheduling | ts-fsrs (FSRS-5 algorithm) |
| Sandbox | quickjs-emscripten (QuickJS WASM) |
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

Executes card JavaScript in QuickJS WASM contexts.

```typescript
// Key implementation
const QuickJS = await getQuickJS();
const runtime = QuickJS.newRuntime();
runtime.setMemoryLimit(8 * 1024 * 1024); // 8MB limit
runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 1000)); // 1s limit
const vm = runtime.newContext();
```

> **Migration note:** Originally used `isolated-vm` (V8 isolates), migrated to QuickJS WASM due
> to `isolated-vm` being in maintenance mode with known security vulnerabilities
> (CVE-2022-39266: sandbox escape via cached data, CVSS 9.8; CVE-2021-21413: prototype chain
> traversal leading to sandbox escape) and process-level crash risks from sharing the host V8.
> QuickJS WASM provides a harder isolation boundary via WebAssembly with no native compilation.

**Security features:**
- WASM isolation (separate engine, not the host V8 process)
- Fresh context per execution
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
**Fix:** (Original isolated-vm fix: changed to `new ivm.Callback()`; later migrated to QuickJS WASM where Math.random is exposed via `vm.newFunction`)

### 4.6 Enrollment Unique Constraint
**Error:** `Unique constraint failed on userId_curriculumId`
**Fix:** Changed `prisma.userCurriculumEnrollment.create()` to `upsert()`

### 4.7 "All Caught Up" UX
**Issue:** Shows past due time when cards are actually due
**Fix:** Added logic to detect past-due cards and show "Cards Ready!" instead

---

## 5. Implementation Status (Updated April 2026)

### 5.1 Services

| Service | LLD Spec | Status |
|---------|----------|--------|
| FSRSOptimizationService | Native Rust optimizer | Implemented via `@open-spaced-repetition/binding` |
| LLMService | Card generation, theming | Implemented (OpenAI + Groq/Gemini/Together support) |
| ImportExportService | JSON serialization | Implemented (card/subject/curriculum with DAG validation) |

### 5.2 API Routes

| Route Group | Status |
|-------------|--------|
| `/api/cards/*` | Complete (full CRUD + test endpoint) |
| `/api/classes/*` | Complete (CRUD, students, curricula, analytics) |
| `/api/llm/*` | Complete (generate, revise, polish) |
| `/api/import`, `/api/export` | Complete |
| `/api/optimization/*` | Endpoint exists (optimization logic stubbed) |

### 5.3 UI Components

| Component | Status |
|-----------|--------|
| CardCodeEditor | Implemented with Monaco + AI generation/revision |
| SubjectEditor | Implemented (form-based) |
| CurriculumEditor | Implemented (form-based prerequisite management; visual DAG deliberately not planned) |
| EducatorDashboard | Implemented (role-based dashboard + educator portal) |

### 5.4 Features

- **2FA/TOTP** - Fully implemented (enable, verify, disable, QR codes, backup codes)
- **Theme selection** - Implemented (system/light/dark toggle)
- **Class management** - Implemented (create classes, manage students, assign curricula, analytics)
- **Tests** - 15+ test files (services, API routes, components)

### 5.5 Remaining Gaps

- **FSRS parameter optimization** - Implemented via `@open-spaced-repetition/binding`
- **Visual DAG editor** - Deliberately not building; form-based prerequisite management is sufficient

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
| Native FSRS optimizer | Implemented | `@open-spaced-repetition/binding` Rust optimizer |
| Visual DAG editor | Form-based UI | Deliberately scoped out |

### 6.3 Architecture Strengths

1. **Security model** - Answers never sent to client, validated server-side
2. **Sandbox isolation** - Untrusted code runs in QuickJS WASM
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
prisma/
├── schema.prisma              # Database schema
├── seed.ts                    # Test data
└── dev.db                     # SQLite database
src/
├── app/
│   ├── api/
│   │   ├── auth/              # NextAuth routes + 2FA
│   │   ├── study/             # Study session API
│   │   ├── cards/             # Card CRUD + test
│   │   ├── classes/           # Class management
│   │   ├── curricula/         # Curriculum API
│   │   ├── llm/               # LLM generate/revise/polish
│   │   ├── import/            # Import endpoint
│   │   ├── export/            # Export endpoint
│   │   └── optimization/      # FSRS optimization
│   ├── (auth)/                # Login, register pages
│   ├── dashboard/             # Role-based dashboard
│   ├── educator/              # Educator portal
│   ├── curricula/             # Curriculum browser
│   └── study/                 # Study session page
├── components/
│   ├── ui/                    # UI components
│   ├── study/                 # Study view
│   ├── editor/                # Monaco code editor
│   └── educator/              # Educator forms
├── services/
│   ├── sandbox.service.ts     # QuickJS WASM sandbox execution
│   ├── fsrs.service.ts        # FSRS scheduling
│   ├── study.service.ts       # Study orchestration
│   ├── validation.service.ts  # Answer validation
│   ├── curriculum.service.ts  # Curriculum/subject management
│   ├── card.service.ts        # Card CRUD
│   ├── llm.service.ts         # LLM integration
│   ├── import-export.service.ts # JSON import/export
│   └── optimization.service.ts  # FSRS optimization (@open-spaced-repetition/binding)
└── lib/
    ├── auth.ts                # NextAuth config
    ├── prisma.ts              # Prisma client
    └── types/                 # TypeScript types
docs/
└── IMPLEMENTATION_REPORT.md   # This file
```

---

## 9. Next Steps (Priority Order)

1. **Production Database** - Migrate to PostgreSQL
3. **Instance Mode Support** - Implement community/publisher/school modes (see ROADMAP.md)
4. **Password Reset** - With session revocation
5. **OIDC SSO** - Generic provider support

---

## 10. Conclusion

The platform is feature-complete for senior project scope:
- Programmable flashcards execute in secure QuickJS WASM sandboxes
- FSRS scheduling adapts to student performance
- Prerequisite DAG enforces learning order
- Server-side answer validation prevents cheating
- Monaco editor with LLM-assisted card authoring
- Full educator tooling (curriculum/subject/card/class management)
- Import/export, 2FA, theme support, and test coverage

See ROADMAP.md for post-senior-project priorities.
