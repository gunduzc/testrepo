---
geometry: margin=2.5cm
fontsize: 11pt
header-includes:
  - \usepackage{longtable}
  - \usepackage{booktabs}
  - \usepackage{array}
  - \setlength{\parskip}{0.6em}
  - \setlength{\parindent}{0pt}
  - \renewcommand{\arraystretch}{1.5}
  - \setlength{\LTpre}{1em}
  - \setlength{\LTpost}{1em}
  - \setlength{\tabcolsep}{6pt}
---

\begin{center}

{\Large TOBB Ekonomi ve Teknoloji Üniversitesi}

{\large Bilgisayar Mühendisliği Bölümü}

\vspace{0.5em}

Bitirme Projesi --- BİL496

\vspace{2em}

{\LARGE \textbf{Programlanabilir Aralıklı Tekrar Öğrenme Platformu}}

\vspace{0.5em}

{\large Final Rapor}

\vspace{2em}

{\large Grup KORN}

\vspace{1em}

\begin{tabular}{ll}
Ahmet Babagil & 211101067 \\
Cemil Gündüz & 211101015 \\
Emre Ekşi & 211104087 \\
Seda Naz Dolu & 201104084 \\
\end{tabular}

\vspace{2em}

Nisan 2026

\end{center}

\newpage

\newpage

## 1. Introduction

This report presents the final state of the Programmable Spaced Repetition Learning Platform, a self-hosted web application that enables organizations to deploy evidence-based spaced repetition learning at institutional scale.

Educators write JavaScript functions that generate infinite question variations. These functions execute in a secure WebAssembly sandbox. Students study with the FSRS-5 algorithm, which adapts review scheduling to individual memory patterns. The platform supports three deployment modes (community, publisher, school) and provides role-based access control, two-factor authentication, LLM-assisted card authoring, and curriculum management with prerequisite DAGs.

The project was developed as a senior design project (BİL495/496) at TOBB University of Economics and Technology, Department of Computer Engineering.

\newpage

## 2. Final Architecture and Design

### 2.1 Layered Architecture

The platform uses a two-layer architecture within a single Next.js application:

- **Core Layer** (`services/`, `lib/`): Pure business logic with no React dependency. Contains all services (sandbox, FSRS, validation, LLM, import/export, study orchestration), the Prisma data model, and shared TypeScript types. Testable independently via automated tests.

- **UX Layer** (`app/`, `components/`): React components consuming the Core Layer via API routes. All pages, editors, and dashboards. Zero business logic. The UX layer could be replaced without affecting the Core Layer.

```
UX Layer (app/, components/)
    ↓ HTTP
API Routes (app/api/)
    ↓ calls
Core Layer (services/)
    ↓ queries
Data Layer (prisma/)
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| Framework | Next.js 16 (App Router) | Server-side rendering, API routes |
| Language | TypeScript | Type safety throughout |
| Database | SQLite (dev) / PostgreSQL (prod) | Persistent storage via Prisma ORM |
| Auth | NextAuth.js v5 | Session management, JWT, credentials provider |
| Scheduling | ts-fsrs v5.2.3 | FSRS-5 spaced repetition algorithm |
| Sandbox | quickjs-emscripten (QuickJS WASM) | Isolated execution of user-submitted JavaScript |
| LLM | OpenAI-compatible API (provider-agnostic) | Optional AI card generation and revision |
| UI | React 19, Tailwind CSS, Monaco Editor | Interface, styling, code editing |

### 2.3 Core Services

**SandboxService:** Executes educator-authored JavaScript in QuickJS WASM contexts. Each execution gets a fresh runtime with 8 MB memory limit and 1-second timeout. No host APIs are exposed except `Math.random`. The sandbox was migrated from `isolated-vm` (V8 isolates) to QuickJS WASM due to known security vulnerabilities in `isolated-vm` (CVE-2022-39266, CVE-2021-21413) and its maintenance-mode status.

**FSRSService:** Wraps ts-fsrs for spaced repetition scheduling. Handles card state transitions (NEW, LEARNING, REVIEW, RELEARNING), computes ratings based on correctness, and selects the next due card respecting prerequisite ordering. Supports configurable learning, relearning, and review steps per card. Parameter optimization is provided by `@open-spaced-repetition/binding`, the official Rust-based FSRS optimizer, which computes optimal parameters from accumulated review logs.

**AnswerValidationService:** Validates student answers with type-based normalization: INTEGER (parse, ignore leading zeros, scientific notation), DECIMAL (epsilon comparison), TEXT (trim, case-insensitive), FRACTION (reduce to lowest terms), CHOICE (exact match). Supports custom validation functions executed in the sandbox.

**StudySessionService:** Orchestrates the study flow. Selects a card via FSRS, executes it in the sandbox, stores the correct answer server-side (never sent to client), validates the student's submission, updates FSRS state, and logs the review. Supports undo within a session.

**LLMService:** Generates card functions from natural language descriptions, revises functions based on flagged samples, and polishes functions based on educator feedback. Uses the OpenAI-compatible API protocol, supporting any provider (OpenAI, Groq, Gemini, Together, local models via Ollama/vLLM). The platform does not endorse any specific provider. LLM features are entirely optional.

**CurriculumService:** Manages curricula, subjects, and cards with DAG validation. Uses Kahn's algorithm for cycle detection when adding prerequisite relationships.

**ImportExportService:** Serializes and deserializes curricula, subjects, and cards as JSON. Validates card functions in the sandbox during import. Preserves all card settings including learning step configuration.

### 2.4 Security Model

1. **Sandbox isolation:** User-submitted code runs in QuickJS WASM, a separate JavaScript engine compiled to WebAssembly. This provides a hard isolation boundary — the sandbox cannot access the host process, filesystem, or network.
2. **Server-side answer validation:** Correct answers are stored in `ActiveStudySession` on the server and never sent to the client. Validation happens server-side on submission.
3. **Role-based access control:** Three roles (Admin, Educator, Student) with per-route authorization checks on all 43 API routes.
4. **Two-factor authentication:** Optional TOTP (RFC 6238) with encrypted secret storage. When enabled, 2FA is enforced at login — the login flow requires a valid TOTP code before authentication completes.
5. **Password security:** bcrypt with 12 salt rounds.
6. **Data sovereignty:** Self-hosted architecture ensures all data stays within the deploying organization's infrastructure.

### 2.5 Instance Modes

The platform supports three deployment modes via the `INSTANCE_MODE` environment variable:

| Mode | Content creation | Content access | Classes |
|:-----|:----------------|:---------------|:--------|
| Community | Everyone | Open browse | No |
| Publisher | Educators only | Open browse | No |
| School | Educators only | Class assignment | Yes |

Registration is configured independently via `REGISTRATION` (open, closed, domain, invite, code). Prerequisite enforcement is configurable per instance (hard, soft, none).

\newpage

## 3. Final Project Status

The platform is feature-complete for the senior project scope. The core study loop works end-to-end: a student can register, enroll in a curriculum, study dynamically generated questions with FSRS scheduling, and track progress.

### 3.1 Implemented Features

| Category | Features |
|:---------|:---------|
| Study | FSRS-5 scheduling, binary rating (pass/fail), undo, prerequisite enforcement |
| Card authoring | Monaco editor, sandbox preview, LLM generation/revision/polishing |
| Curriculum | Subject management, prerequisite DAGs, import/export as JSON |
| Class management | Create classes, manage students, assign curricula, analytics dashboard |
| Authentication | Login, registration, 2FA (TOTP), role-based access |
| Admin | User management (role, name, email, password, 2FA), content oversight, instance settings |
| Data protection | Configurable legal notice (aydınlatma metni), data export endpoint, self-host architecture |
| UI | Dark/light/system theme, responsive design, KaTeX math rendering |

### 3.2 Deliberate Scope Decisions

| Feature | Decision | Rationale |
|:--------|:---------|:----------|
| Visual DAG editor | Not building | Form-based prerequisite management is sufficient |
| FSRS parameter optimization | Implemented | Uses `@open-spaced-repetition/binding` for real parameter computation from review logs |
| User testing | Not conducted | Insufficient time within project scope |
| Self-service account management | Planned for community mode | Admin panel covers institutional deployments |

\newpage

## 4. Impact of Engineering Solutions

### 4.1 Economic Impact

The platform eliminates per-seat licensing costs for organizational spaced repetition. Commercial alternatives such as Quizlet for Schools use per-user pricing models. As an AGPL-3.0 self-hosted platform, organizations deploy at infrastructure cost only. The AGPL license ensures that modified versions served over a network must share their source code (Section 13), preventing proprietary capture while allowing free institutional use.

### 4.2 Social Impact

Spaced repetition (distributed practice) is one of only two learning strategies rated "high utility" by Dunlosky et al. (2013) in their review of ten techniques [1]. Despite this evidence, institutional adoption remains low because existing tools (e.g., Anki) are designed for individual use and lack class management, curriculum structure, and educator authoring workflows. This platform bridges that gap by providing organizational tooling around a proven algorithm.

Programmable cards generate infinite question variations, preventing rote memorization of specific answers. Prerequisite DAGs enforce pedagogically sound progression — students cannot skip foundational material.

### 4.3 Environmental Impact

Direct environmental impact is minimal. The platform is software running on existing server infrastructure with no dedicated hardware requirements. It replaces paper-based flashcard systems at scale.

### 4.4 Global Context

The platform is designed for international deployment:

- Self-hosted architecture enables deployment in any jurisdiction, respecting local data protection laws (KVKK in Turkey, GDPR in the EU).
- LLM integration is provider-agnostic — organizations choose their own provider, including local models for data-sensitive environments.
- The platform's i18n-ready structure (string keys, configurable content) supports future localization.
- AGPL licensing ensures the platform remains accessible to organizations regardless of economic context.

\newpage

## 5. Contemporary Issues

### 5.1 Untrusted Code Execution in Web Applications

Executing user-submitted code on a server is a well-known security challenge. The project initially used `isolated-vm`, a popular Node.js package for V8 sandboxing. During development, two critical vulnerabilities were identified: CVE-2022-39266 (sandbox escape via cached data, CVSS 9.8) and CVE-2021-21413 (prototype chain traversal leading to sandbox escape, CVSS 9.6). The package was also in maintenance mode with no active development.

The project migrated to QuickJS compiled to WebAssembly (`quickjs-emscripten`). WASM provides a fundamentally different isolation model: the sandbox runs a separate JavaScript engine in a WebAssembly virtual machine, with no shared memory or process space with the host. This eliminates the class of vulnerabilities where sandbox code exploits the host V8 engine.

### 5.2 Data Protection in Educational Technology

Educational platforms collect sensitive data about learning patterns, performance, and behavior. Turkey's KVKK (Law 6698) and the EU's GDPR regulate how this data must be handled. A key tension in EdTech is that cloud-hosted SaaS platforms require organizations to trust a third party with student data.

This project addresses this by making self-hosting the primary deployment model. The deploying organization is the data controller (veri sorumlusu) under KVKK [2]; the software developer has no access to the data. The platform provides technical tools for compliance: configurable privacy notices (Madde 10), data export (Madde 11), admin-managed user data correction and deletion (Madde 11), and encryption at rest (Madde 12). Organizations can process learning data without explicit consent under contract (Md. 5/2-c) or legal obligation (Md. 5/2-ç) bases.

### 5.3 Spaced Repetition Algorithm Evolution

The FSRS (Free Spaced Repetition Scheduler) algorithm represents a significant advance over older algorithms like SM-2 (used by Anki since 2006). FSRS uses a stochastic shortest path model [3] trained on millions of real review logs, achieving better prediction of memory states than SM-2. The project uses FSRS-5 via the ts-fsrs library (v5.2.3), the official TypeScript implementation by the algorithm's author.

A contemporary challenge is parameter optimization: FSRS performs best when its 21 parameters (FSRS-6) are tuned to individual learner data. The project integrates `@open-spaced-repetition/binding`, the official Rust-based optimizer, to compute optimized parameters from review logs. Optimization can run globally (all users' data) or per-student, requiring a minimum of 100 reviews.

### 5.4 LLM Integration in Educational Content Creation

Large language models are increasingly used for educational content generation. This project integrates LLM-assisted card authoring: educators describe a card concept in natural language, the LLM generates a JavaScript function, and the educator reviews and refines it through iterative feedback.

A key design decision is provider agnosticism. The platform uses the OpenAI-compatible API protocol (`OPENAI_BASE_URL`, `LLM_MODEL` environment variables) but does not endorse or depend on any specific provider. Organizations can use OpenAI, Groq, Gemini, Together, or local models (Ollama, vLLM). This ensures data sovereignty — organizations that cannot send data to external APIs can run local models.

\newpage

## 6. New Tools and Technologies

### 6.1 QuickJS WASM (quickjs-emscripten)

QuickJS is a small, embeddable JavaScript engine by Fabrice Bellard. The `quickjs-emscripten` package compiles it to WebAssembly, enabling JavaScript execution in a fully isolated WASM sandbox within Node.js. Unlike `isolated-vm` (which shares the host V8 process), QuickJS WASM provides process-level isolation with no native compilation required. The project uses it to execute educator-authored card functions with strict memory (8 MB) and time (1 second) limits.

### 6.2 ts-fsrs (FSRS-5 Algorithm)

ts-fsrs is the official TypeScript implementation of the Free Spaced Repetition Scheduler. It implements the FSRS-5 algorithm with 19 tunable parameters for predicting optimal review intervals. The project uses it for all scheduling decisions: card state management, review interval computation, and rating derivation.

### 6.3 Next.js 16 App Router

The project uses Next.js with the App Router architecture, which provides React Server Components, file-based routing for both pages and API endpoints, and built-in middleware. Server Components enable database queries in page components without API round-trips for read-heavy pages like the dashboard.

### 6.4 Prisma ORM

Prisma provides type-safe database access with auto-generated TypeScript types from the schema. The project uses it with SQLite for development and is configured for PostgreSQL in production. The schema defines 18 models covering users, cards, curricula, study state, and organizational structure.

### 6.5 Monaco Editor

Microsoft's Monaco Editor (the engine behind VS Code) is integrated for card code authoring. It provides syntax highlighting, error detection, and autocompletion for JavaScript, making the card authoring experience accessible to educators who may not be professional developers.

\newpage

## 7. Background Research and Similar Systems

### 7.1 Existing Spaced Repetition Systems

| System | Open Source | Institutional | Programmable Cards | Algorithm |
|:-------|:-----------|:-------------|:-------------------|:----------|
| Anki | Yes (GPL) | No (individual) | No (static) | SM-2 |
| SuperMemo | No | No (individual) | No (static) | SM-18 |
| Quizlet | No | Yes (per-seat) | No (static) | Proprietary |
| Memrise | No | No (individual) | No (static) | Proprietary |
| Mochi | No | No (individual) | No (static) | SM-2 variant |
| **This project** | **Yes (AGPL)** | **Yes (self-host)** | **Yes (JavaScript)** | **FSRS-5** |

The project occupies a unique position: it is the only open-source, institutionally-oriented platform with programmable card generation and a modern scheduling algorithm (FSRS-5). Anki is the closest in openness but lacks institutional features; Quizlet is the closest in institutional support but is proprietary and uses static cards.

### 7.2 Engineering Principles

**Sandboxed execution:** The approach of executing untrusted code in an isolated environment follows the same principle as browser sandboxing (Chromium's site isolation) and serverless function execution (AWS Lambda's Firecracker microVMs). The project applies this principle at the application level using WASM isolation.

**Spaced repetition theory:** The platform is grounded in the spacing effect, first documented by Ebbinghaus (1885) and extensively validated in modern research. Dunlosky et al. (2013) rated distributed practice as "high utility" based on evidence across age groups, materials, and retention intervals [1]. The FSRS algorithm builds on this research using machine learning to optimize review intervals [3].

**Data protection by design:** The self-hosted architecture implements the GDPR/KVKK principle of data protection by design (privacy by design). Rather than adding privacy features to a cloud service, the architecture ensures data never leaves the organization's control.

\newpage

## 8. Test Results

Testing was conducted using Vitest 2.1.9 with mocked Prisma database access.

### 8.1 Test Summary

| Metric | Value |
|:-------|:------|
| Total test cases | 276 |
| Passed | 276 |
| Failed | 0 |
| Pass rate | 100% |
| Test files | 15 |
| Execution time | 3.35 seconds |

### 8.2 Results by Test File

| Test File | Tests | Duration | Result |
|:----------|:------|:---------|:-------|
| validation.service.test.ts | 49 | 16ms | Pass |
| sandbox.service.test.ts | 25 | 2079ms | Pass |
| instance-config.test.ts | 23 | 14ms | Pass |
| curriculum.service.test.ts | 22 | 20ms | Pass |
| fsrs.service.test.ts | 22 | 35ms | Pass |
| card.service.test.ts | 21 | 17ms | Pass |
| study.service.test.ts | 21 | 31ms | Pass |
| import-export.service.test.ts | 21 | 16ms | Pass |
| prereq.service.test.ts | 18 | 13ms | Pass |
| llm.service.test.ts | 13 | 11ms | Pass |
| answer-input.test.tsx | 11 | 128ms | Pass |
| study/route.test.ts | 10 | 43ms | Pass |
| cards/route.test.ts | 8 | 40ms | Pass |
| cards/test/route.test.ts | 7 | 47ms | Pass |
| curricula/route.test.ts | 5 | 24ms | Pass |

### 8.3 Test Coverage

| Category | Requirements | Test Cases | Coverage |
|:---------|:-------------|:-----------|:---------|
| Card Management | FR-01 to FR-05 | TC-01 to TC-08 | 100% |
| Sandbox Execution | FR-06 to FR-11 | TC-09 to TC-15 | 100% |
| Study Sessions | FR-12 to FR-17 | TC-16 to TC-25 | 100% |
| Answer Validation | FR-18 to FR-23 | TC-26 to TC-40 | 100% |
| Curriculum Management | FR-24 to FR-29 | TC-41 to TC-48 | 100% |
| Instance Configuration | FR-30 to FR-34 | TC-49 to TC-55 | 100% |

All 34 functional requirements are covered by at least one test case.

### 8.4 Code Coverage

| Service | Statement Coverage | Branch Coverage |
|:--------|:-------------------|:----------------|
| card.service.ts | 100% | 82% |
| prereq.service.ts | 98.99% | 90.69% |
| validation.service.ts | 94.68% | 95% |
| import-export.service.ts | 90.82% | 82.6% |
| study.service.ts | 86.24% | 88.88% |
| sandbox.service.ts | 78.17% | 77.77% |

Overall: 39.13% statements, 80.36% branches. The low statement percentage reflects UI components that require end-to-end testing; core business logic averages 91.5% statement coverage.

### 8.5 Defects Found and Fixed

| Bug ID | Description | Severity | Status |
|:-------|:-----------|:---------|:-------|
| BUG-01 | JSON.parse crashes on invalid tags | Medium | Fixed |
| BUG-02 | INTEGER validation fails for scientific notation (1e5) | Low | Fixed |
| BUG-03 | LLM prompt missing solution field | High | Fixed |
| BUG-04 | Import/export missing reviewSteps field | Medium | Fixed |
| BUG-05 | Default card template missing solution field | Medium | Fixed |
| BUG-06 | Card editor missing LLM integration UI | High | Fixed |
| BUG-07 | Card editor missing reviewSteps field | Medium | Fixed |

### 8.6 Assessment and Limitations

**Strengths:**

- 100% pass rate across all 276 tests
- Core services achieve 78--100% statement coverage
- All 34 functional requirements traced to test cases
- Security-critical paths (sandbox timeout, memory limits, answer isolation) are tested

**Limitations:**

- Tests use mocked Prisma client — database-specific bugs may not be caught
- No browser-based E2E tests (UI tests run in jsdom)
- No load testing — concurrent performance is unknown
- No penetration testing — security relies on architectural analysis, not adversarial testing
- LLM tests use mocked responses — actual provider behavior is not tested

**Recommendations for future testing:**

1. Add Playwright E2E tests for critical user workflows
2. Implement load testing for concurrent sandbox execution
3. Add integration tests with a real database
4. Conduct security penetration testing

\newpage

## 9. References

[1] Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). "Improving Students' Learning With Effective Learning Techniques." *Psychological Science in the Public Interest*, 14(1), 4--58. <https://doi.org/10.1177/1529100612453266>

[2] T.C. Resmî Gazete, "6698 Sayılı Kişisel Verilerin Korunması Kanunu," 7 Nisan 2016. <https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf>

[3] Ye, J. (2022). "A Stochastic Shortest Path Algorithm for Optimizing Spaced Repetition Scheduling." *Proc. 28th ACM SIGKDD*. Ye, J. (2023). "Optimizing Spaced Repetition Schedule by Capturing the Dynamics of Memory." *IEEE TKDE*. <https://github.com/open-spaced-repetition/ts-fsrs>

[4] OWASP Foundation, "OWASP Top 10:2021." <https://owasp.org/Top10/>

[5] NIST, "CVE-2022-39266 — isolated-vm sandbox escape," CVSS 9.8. <https://nvd.nist.gov/vuln/detail/CVE-2022-39266>

[6] NIST, "CVE-2021-21413 — isolated-vm prototype chain escape," CVSS 9.6. <https://nvd.nist.gov/vuln/detail/CVE-2021-21413>

[7] Free Software Foundation, "GNU Affero General Public License, Version 3." <https://www.gnu.org/licenses/agpl-3.0.en.html>

[8] KVKK Kurul Kararı 2020/71 — Veri sorumlusu belirleme kriterleri. <https://www.kvkk.gov.tr/Icerik/6874/2020-71>

[9] W3C, "Web Content Accessibility Guidelines (WCAG) 2.1." <https://www.w3.org/TR/WCAG21/>

[10] IETF, "RFC 6238 — TOTP: Time-Based One-Time Password Algorithm." <https://datatracker.ietf.org/doc/html/rfc6238>

[11] ISO/IEC/IEEE, "ISO/IEC/IEEE 12207:2017 — Software life cycle processes." <https://www.iso.org/standard/63712.html>
