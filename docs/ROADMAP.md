# Roadmap

## Architecture Decisions

### License
- **AGPL-3.0** (dual license TBD for commercial use)

### Instance Modes
```bash
INSTANCE_MODE=community|publisher|school
```

| Mode | Who creates? | Who studies? | Access model | Classes? |
|------|--------------|--------------|--------------|----------|
| Community | Everyone (Students can create) | Everyone | Open browse | No |
| Publisher | Educators only | Everyone | Open browse | No |
| School | Educators only | Assigned students | Restricted | Yes |

**Educator role per mode:**
- **Community**: Not needed - everyone creates, Admin moderates
- **Publisher**: Distinct from readers - creates content
- **School**: Creates content + assigns to classes

### Registration (orthogonal to mode)
```bash
REGISTRATION=open|domain|sso|invite|code
```

Any combination is valid:
| Example | INSTANCE_MODE | REGISTRATION |
|---------|---------------|--------------|
| Public wiki-style | community | open |
| Private study group | community | invite |
| Khan Academy-like | publisher | open |
| Corporate training | publisher | sso |
| Public school | school | domain |
| Private school | school | code |

### Content Model
**Subjects are global, curricula are compositions:**
- Subjects form a global DAG with prerequisites
- Curriculum = a set of subjects (not "owning" them)
- Subject can appear in multiple curricula
- Curriculum external prerequisites = subject prerequisites NOT in the curriculum

```
Subjects (global DAG):
  Arithmetic → Algebra → Calculus
                      ↘
                        Linear Algebra

Curriculum "Calc 101": {Algebra, Calculus}
  → External prereq: Arithmetic (required by Algebra, not in curriculum)
```

**Visibility is mode-determined:**
- Community/Publisher: Everything visible to everyone
- School: Access by class assignment only
- No per-curriculum `isPublic` flag needed

**Students can be in multiple classes** (many-to-many via ClassEnrollment)

### Authentication
- **SSO**: Generic OIDC (covers Google, Microsoft, Okta, etc.)
- **2FA**: TOTP + WebAuthn (optional, admin security)
- **"Log out everywhere"**: Revoke all sessions (no full session management UI needed)
- Password reset also revokes all sessions

### Prerequisite Enforcement
```bash
# Mode defaults: school=hard, community/publisher=soft
# Optional instance override:
PREREQ_ENFORCEMENT=hard|soft|none
```

| Setting | Behavior |
|---------|----------|
| hard | Block enrollment until prereqs completed |
| soft | Warning: "You're missing X, continue anyway?" |
| none | Informational display only |

### Subject Mastery
- **Criteria**: All cards in Review state (graduated from Learning)
- Once mastered, dependent subjects unlock

### Curriculum Updates (Live Content)
Curricula are living - updates apply to enrolled students automatically.

**Scenario 1: New subject with satisfied prereqs**
```
Student: Mastered Algebra
Educator: Adds Linear Algebra (requires Algebra)
Result: Linear Algebra unlocks immediately
```

**Scenario 2: New subject with unsatisfied prereqs**
```
Student: Working on Calculus
Educator: Adds Real Analysis (requires Calculus)
Result: Real Analysis stays locked until Calculus mastered
```

**Scenario 3: New prerequisite inserted retroactively**
```
Student: Already mastered Algebra
Educator: Adds Pre-Algebra as prerequisite to Algebra
Result: Grandfathered - student keeps Algebra mastery, Pre-Algebra not required
```

**Rule**: If student has mastered a subject, new prerequisites added below it don't apply retroactively. They've already proven the knowledge.

### Progress Reset

| Mode | Who can reset? | Granularity |
|------|----------------|-------------|
| Community | User (self) | Full or per-subject |
| Publisher | User (self) | Full or per-subject |
| School | Educator only | Per-student, full or per-subject |

### Study Session Completion
- **All cards done**: "Done for today" message
- **No early review**: FSRS scheduling is respected, reviews not pulled forward
- **Want more?**: Enroll in additional curricula

### Content Deletion
- **Soft delete**: Cards/subjects marked as deleted, not removed from database
- **Progress preserved**: StudentCardState records kept for analytics
- **Hidden from study**: Deleted content excluded from study queue
- **Restorable**: Admins/educators can restore deleted content

### Rating System
- **Binary**: Pass/Fail only (maps to FSRS Good/Again)
- FSRS performs better with binary data
- Simpler UX, no "was that Hard or Good?" decision fatigue

### Mobile Support
- **Mobile-essential**: Students study on phones, must work well
- Responsive design required for all study flows
- Touch-friendly inputs and navigation

### Internationalization
- **i18n-ready**: Structure code for translation (string keys, not hardcoded)
- English only for senior project scope
- Additional languages can be added later without refactoring

### Card Media
- **Images supported**: Via URL references in markdown
- Object storage (S3, R2) is a later enhancement

### Undo
- **Session history**: Can undo multiple answers within current study session
- Session ends when user leaves study page
- Undo stack cleared on session end

### Sandbox Failure
- **Retry then skip**: If card JS crashes/times out, retry once, then skip
- **Report to educator**: Log error, notify card author
- Student not blocked by broken cards

### Email
- **Generic SMTP**: Instance admin provides SMTP credentials
- Used for password reset, email verification
- No specific provider integrations needed

### GDPR Export
- **JSON format**: Complete machine-readable export
- Includes: profile, progress, review history, enrollments

### LLM Provider
- **Configurable**: Instance admin sets provider (OpenAI, Anthropic, etc.)
- Environment variables for API keys and model selection

### Database
- **Development**: SQLite
- **Production**: PostgreSQL

### Testing
- **Comprehensive**: Unit, integration, and E2E tests
- High coverage target

### Deployment
- **Docker**: Primary deployment method

### Study Mechanics
- **No daily limits**: No cap on new cards or reviews
- **No hints/explanations**: Not for now
- **No gamification**: No streaks, badges, XP for now
- **Card order**: FSRS priority
- **Record everything**: Log all data for future analytics/features

### Logging & CI/CD
- **Logging**: Structured JSON to stdout, health check endpoint
- **CI/CD**: GitHub Actions - lint, typecheck, tests on PR; full suite + Docker build on merge

---

## Completed Features

- [x] Authentication (login/register, sessions, logout)
- [x] Role-based access (Admin, Educator, Student)
- [x] Dark mode
- [x] Educator curriculum/subject/card management
- [x] Programmable card system with Monaco editor
- [x] FSRS spaced repetition algorithm
- [x] Study interface with KaTeX rendering
- [x] Binary rating (Pass/Fail) + undo
- [x] Import/export curricula as JSON
- [x] Admin dashboard (user management, content oversight)
- [x] Classroom management (create classes, add students, assign curricula)
- [x] Preview mode for educators (no progress saved)

---

## To Build

### Priority 1: Core
| Feature | Backend | Frontend | Notes |
|---------|---------|----------|-------|
| Instance mode support | Missing | Missing | INSTANCE_MODE env var |
| Password reset + session revocation | Missing | Missing | Critical for production |
| Email verification | Schema exists | Missing | Anti-spam |
| Per-card learning/relearning steps UI | Done | Missing | Core FSRS config |
| FSRS actual optimization | Stubbed | N/A | Currently returns defaults |
| Global subject DAG refactor | Partial | Missing | Subjects reusable across curricula |

### Priority 2: Important
| Feature | Backend | Frontend | Notes |
|---------|---------|----------|-------|
| LLM card canvas | Service exists | Missing | Chat + editable artifacts UI |
| Student progress dashboard | Partial | Missing | Motivating for learners |
| Class analytics for educators | Missing | Missing | Track student progress (school mode) |
| Generic OIDC SSO | NextAuth ready | Config only | Single implementation, all providers |
| 2FA/WebAuthn (optional) | Partial API | Missing | Admin security |
| GDPR data export | Missing | Missing | Compliance |
| Error pages (404/500) | Missing | Missing | Polish |

### Priority 3: Later
| Feature | Notes |
|---------|-------|
| Offline study (PWA) | Cache cards locally, sync when online |
| Object storage for media | S3, Cloudflare R2, etc. (URL references for now) |
| Rate limiting | Infrastructure level |
| Per-card theming/variations | Young audiences, problem variations |
| Visual DAG editor | Subject prerequisite visualization |
| Full-text search | When scale demands |
| Advanced scheduling algorithm | Use collected data for better predictions |

---

## Not Building

| Feature | Reason |
|---------|--------|
| Session management UI | Password reset revokes all sessions |
| Admin impersonation | Admins can create test users if needed |
| Card authoring history viewer | Not actionable |
| Notifications system | External tools (email, calendar) |
| Per-class step overrides | Per-card is sufficient |
| Community voting/flagging | Admin curation model instead |
| Keyboard shortcuts | Polish, not core |
| Themes system | Maybe per-card variations later |
| Per-curriculum isPublic flag | Mode determines visibility |
| Explicit curriculum prerequisites | Emerges from subject DAG |
| Admin curriculum approval workflow | Mode handles access, not needed |

---

## Schema Changes Needed

### Update: Subject (global DAG)
```prisma
model Subject {
  id            String   @id @default(cuid())
  name          String
  description   String?
  authorId      String   // Who created this subject
  author        User     @relation(fields: [authorId], references: [id])

  cards         CardSubject[]
  prerequisites SubjectPrerequisite[] @relation("dependent")
  dependents    SubjectPrerequisite[] @relation("prerequisite")
  curricula     CurriculumSubject[]
}

// Global DAG - not curriculum-specific
model SubjectPrerequisite {
  subjectId      String
  prerequisiteId String
  subject        Subject @relation("dependent", fields: [subjectId], references: [id])
  prerequisite   Subject @relation("prerequisite", fields: [prerequisiteId], references: [id])

  @@id([subjectId, prerequisiteId])
}
```

### Update: User (password reset)
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Remove: Curriculum.isPublic
```prisma
model Curriculum {
  // Remove: isPublic Boolean
  // Visibility determined by INSTANCE_MODE
}
```

---

## LLM Card Canvas Design

Chat + editable artifacts interface:

```
┌─────────────────────────┬─────────────────────────┐
│ Chat                    │ Cards (editable)        │
├─────────────────────────┼─────────────────────────┤
│ > Generate 5 cards      │ ┌─────────────────────┐ │
│   about derivatives     │ │ Card 1: Basic       │ │
│                         │ │ d/dx of x²          │ │
│ Here are 5 cards...     │ │ [Edit] [Delete]     │ │
│                         │ └─────────────────────┘ │
│ > Make card 3 harder    │ ┌─────────────────────┐ │
│                         │ │ Card 2: Chain rule  │ │
│ Updated card 3...       │ │ ...                 │ │
│                         │ └─────────────────────┘ │
│ > [user edits card 1    │         ...             │
│    directly on right]   │                         │
└─────────────────────────┴─────────────────────────┘
```

- Conversational refinement: "make harder", "add hints", "split this"
- Direct editing: click card, edit in Monaco editor
- Batch operations: "delete cards 2-4", "move to subject X"

---

## Data Collection

Collect everything for future algorithm improvements.

| Field | Description |
|-------|-------------|
| `responseTimeMs` | Time from question display to answer submission |
| `answerMedium` | enum: MENTAL, TYPING, PEN_PAPER, OTHER |
| `generatedQuestion` | The actual question shown |
| `generatedAnswer` | The correct answer for this instance |
| `cardId` | The card that generated this question |
| `success` | Binary pass/fail |
| `timestamp` | When the review occurred |
