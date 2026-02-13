# Architecture Documentation

## Overview

The Programmable Spaced Repetition Learning Platform is built with a two-layer architecture within a single Next.js application:

1. **Core Layer** (`lib/`, `services/`): Pure business logic with no React dependency
2. **UX Layer** (`app/`, `components/`): React components consuming the Core Layer via API routes

## Directory Structure

```
/
├── prisma/
│   └── schema.prisma          # Database schema (SQLite)
├── src/
│   ├── lib/
│   │   ├── types/             # Shared TypeScript interfaces and enums
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── auth.ts            # NextAuth configuration
│   ├── services/
│   │   ├── sandbox.service.ts     # V8 isolate execution
│   │   ├── fsrs.service.ts        # FSRS scheduling
│   │   ├── optimization.service.ts # Parameter optimization
│   │   ├── validation.service.ts  # Answer validation
│   │   ├── llm.service.ts         # LLM authoring + theming
│   │   ├── card.service.ts        # Card CRUD
│   │   ├── curriculum.service.ts  # Curriculum/subject management
│   │   ├── import-export.service.ts
│   │   └── study.service.ts       # Study session orchestration
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── study/             # Study session pages
│   │   ├── editor/            # Card authoring
│   │   ├── curricula/         # Curriculum browser
│   │   └── dashboard/         # User dashboards
│   └── components/            # Shared React components
└── docs/                      # Documentation
```

## Tech Stack

### Frontend
- **Next.js 15** - App Router with React Server Components
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first styling
- **react-markdown + rehype-katex** - Markdown + LaTeX rendering
- **Monaco Editor** - Code editing for card authoring
- **React Flow** - DAG visualization (planned)

### Backend
- **Next.js API Routes** - REST API
- **Prisma ORM** - Type-safe database access
- **SQLite** - Development database (PostgreSQL for production)

### Authentication
- **NextAuth.js v5** - Session management
- **bcryptjs** - Password hashing
- **otpauth** - TOTP 2FA support

### Machine Learning & Scheduling
- **ts-fsrs** - Free Spaced Repetition Scheduler implementation
- **OpenAI API** - LLM integration for card generation/theming

### Sandbox Execution
- **isolated-vm** - V8 isolate sandboxing for card function execution

## Core Services

### SandboxService
Executes card JavaScript in isolated V8 instances with strict resource limits:
- 8 MB heap limit
- 1 second timeout
- No host APIs (require, fs, network disabled)

### FSRSService
Wraps ts-fsrs for spaced repetition:
- Rating computation based on correctness and response time
- Card state transitions (NEW → LEARNING → REVIEW ⟷ RELEARNING)
- Next card selection with prerequisite checking
- Progress tracking per subject/curriculum

### AnswerValidationService
Validates answers with type-based normalization:
- **INTEGER**: Parse as int, ignore leading zeros
- **DECIMAL**: Parse as float, epsilon 1e-9
- **TEXT**: Trim, case-insensitive
- **FRACTION**: Reduce to lowest terms
- **CHOICE**: Exact match

### StudySessionService
Orchestrates the study flow:
1. Card selection via FSRS
2. Card execution in sandbox
3. Optional question theming via LLM
4. Server-side answer storage (never sent to client)
5. Answer validation and FSRS state update

### CurriculumService
Manages curricula with DAG validation:
- Subject prerequisites using Kahn's algorithm
- Cycle detection on prerequisite addition
- Card ordering within subjects

## Data Flow

### Study Session Flow
1. Student opens study session
2. `GET /api/study/:curriculumId/next` returns QuestionPresentation (no correct answer)
3. Student submits answer via `POST /api/study/submit`
4. Server validates, computes rating, updates FSRS state
5. Returns SubmissionResult with feedback

### Card Authoring Flow
1. Educator writes JavaScript function
2. Function tested via sandbox (10 iterations)
3. On save, function validated and stored
4. Optional LLM-assisted authoring with flagging/revision

## Security Considerations

1. **Sandbox Isolation**: Card code runs in isolated V8 with no host access
2. **Answer Security**: Correct answers never leave server
3. **Input Validation**: Zod schemas on all API endpoints
4. **Role-Based Access**: Admin/Educator/Student permissions
5. **2FA Support**: TOTP with encrypted secret storage
