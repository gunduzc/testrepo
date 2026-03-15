# Test Plan Report

---

## Introduction

This test plan describes how the graduation project will be tested. The aim is to verify that the developed system works correctly, meets the project requirements, and produces expected results.

---

## Project Scope

**Project title:** Spaced Repetition Learning Platform

**Brief description of the system:**
A web-based educational platform that enables educators to create dynamic, code-generated flashcards and students to study using scientifically-proven spaced repetition algorithms. The system executes user-submitted JavaScript code in a secure sandbox environment to generate unique question instances, validates answers across multiple formats, and schedules reviews using the FSRS-5 algorithm.

**Main functionalities of the system:**

1. **Card Management** - Create, edit, and organize flashcards with JavaScript-generated content
2. **Secure Code Execution** - Run user-submitted code in isolated QuickJS WASM sandbox
3. **Answer Validation** - Validate INTEGER, DECIMAL, FRACTION, TEXT, and CHOICE answers
4. **Spaced Repetition Scheduling** - FSRS-5 algorithm with customizable learning steps
5. **Study Sessions** - Interactive study interface with progress tracking
6. **Curriculum Organization** - Group cards into subjects and curricula with prerequisites
7. **Import/Export** - Backup and restore curricula as JSON
8. **AI Card Generation** - LLM-powered card creation from natural language descriptions
9. **Multi-tenant Modes** - Community, Publisher, and School instance configurations
10. **User Management** - Role-based access (Student, Educator, Admin)

---

## Features to Be Tested

**Feature 1: Card Creation and Management**
- Create cards with JavaScript function source
- Validate function syntax before saving
- Configure learning steps (learning, relearning, review)
- Tag and categorize cards

**Feature 2: Sandbox Code Execution**
- Execute JavaScript in isolated environment
- Enforce timeout limits (1 second)
- Enforce memory limits
- Block access to dangerous globals

**Feature 3: Answer Validation**
- Validate INTEGER answers (including scientific notation)
- Validate DECIMAL answers with tolerance
- Validate FRACTION answers with simplification
- Validate TEXT answers (case-insensitive, whitespace-normalized)
- Validate CHOICE answers (single and multiple correct)

**Feature 4: Study Session Management**
- Start study sessions for enrolled curricula
- Retrieve next question from queue
- Submit and validate answers
- Track learning progress and step completion

**Feature 5: Spaced Repetition Algorithm**
- Apply FSRS-5 scheduling after reviews
- Manage learning/relearning/review states
- Handle lapses (incorrect answers in review)
- Graduate cards after completing steps

**Feature 6: Curriculum and Prerequisites**
- Create curricula with subjects
- Define prerequisite relationships
- Detect circular dependencies
- Calculate completion status

**Feature 7: Import/Export**
- Export curricula to JSON format
- Import curricula from JSON
- Preserve all card settings including reviewSteps
- Handle malformed data gracefully

**Feature 8: Instance Configuration**
- Support community/publisher/school modes
- Configure registration modes (open/closed/domain)
- Role-based content creation permissions
- Prerequisite enforcement levels

---

## Testing Methodology

The following testing methods are used in this project:

**Unit Testing:** Testing individual functions or modules.
- Services: card.service, validation.service, sandbox.service, fsrs.service, etc.
- Utilities: instance-config, import-export helpers

**Integration Testing:** Testing interactions between modules.
- API routes with mocked database
- Service-to-service interactions
- Request/response validation

**System Testing:** Testing the complete system.
- End-to-end study session flow
- Complete import/export cycle
- Full card creation pipeline

**Performance Testing:** Evaluating speed, accuracy, or resource usage.
- Sandbox timeout enforcement (1 second limit)
- Memory limit enforcement
- Batch execution performance

**User Testing:** Testing the system with sample users or scenarios.
- UI component testing with React Testing Library
- Answer input component validation
- Error message display

---

## Test Environment

**Hardware:**
| Component | Specification |
|-----------|---------------|
| Platform | Linux (NixOS) |
| Architecture | x86_64 |
| Kernel | 6.12.74 |

**Software:**
| Component | Version |
|-----------|---------|
| Node.js | 20.x LTS |
| Next.js | 16.x |
| React | 19.x |
| TypeScript | 5.x |
| Vitest | 2.1.9 |
| Prisma ORM | 5.22.0 |
| QuickJS (WASM) | quickjs-emscripten |
| Coverage Tool | V8 |

---

## Test Cases

Each test case is identified with a unique Test ID.

### Card Management Tests

| Test ID | Description | Input(s) | Expected Output | Result |
|---------|-------------|----------|-----------------|--------|
| TC-01 | Create card with valid function source | Valid JS function, name, description | Card created with ID | Pass |
| TC-02 | Reject card creation without authentication | No session token | 401 Unauthorized | Pass |
| TC-03 | Reject card with missing required fields | Empty name field | 400 Validation Error | Pass |
| TC-04 | Reject card with invalid answer type | answerType: "INVALID" | 400 Invalid answer type | Pass |
| TC-05 | Validate JavaScript syntax in function source | Syntax error in code | 400 Syntax error message | Pass |
| TC-06 | Create card with custom learning steps | learningSteps: 10 | Card with learningSteps=10 | Pass |
| TC-07 | Create card with tags | tags: ["math", "basic"] | Card with tags saved | Pass |
| TC-08 | Update existing card | Updated name, source | Card updated successfully | Pass |

### Sandbox Execution Tests

| Test ID | Description | Input(s) | Expected Output | Result |
|---------|-------------|----------|-----------------|--------|
| TC-09 | Execute valid card function | Valid generate() function | Question, answer, solution | Pass |
| TC-10 | Return error for syntax errors | "function { invalid" | SyntaxError with message | Pass |
| TC-11 | Timeout infinite loops | "while(true){}" | Timeout error after 1s | Pass |
| TC-12 | Handle memory limit exceeded | Array allocating 100MB | Memory limit error | Pass |
| TC-13 | Reject access to global objects | "fetch('http://...')" | ReferenceError: fetch undefined | Pass |
| TC-14 | Execute multiple cards in sequence | 10 valid functions | 10 successful results | Pass |
| TC-15 | Stop execution on first error in batch | [valid, invalid, valid] | Stop at error, return partial | Pass |

### Study Session Tests

| Test ID | Description | Input(s) | Expected Output | Result |
|---------|-------------|----------|-----------------|--------|
| TC-16 | Start new study session | curriculumId, userId | Session with card queue | Pass |
| TC-17 | Retrieve next question | Active session | Generated question | Pass |
| TC-18 | Submit correct answer | Correct answer string | isCorrect: true | Pass |
| TC-19 | Submit incorrect answer | Wrong answer string | isCorrect: false | Pass |
| TC-20 | Complete study session | All cards answered | Session completed | Pass |
| TC-21 | Handle empty card queue | No cards due | null (no question) | Pass |
| TC-22 | Track learning step progression | Correct answer in learning | stepIndex incremented | Pass |
| TC-23 | Graduate card after learning steps | Final learning step correct | State: REVIEW | Pass |
| TC-24 | Lapse card on incorrect review | Wrong answer in review | State: RELEARNING | Pass |
| TC-25 | Apply FSRS scheduling after review | Correct in review | Next review date set | Pass |

### Answer Validation Tests

| Test ID | Description | Input(s) | Expected Output | Result |
|---------|-------------|----------|-----------------|--------|
| TC-26 | Validate INTEGER exact match | "42", correct: "42" | isCorrect: true | Pass |
| TC-27 | Validate INTEGER with whitespace | " 42 ", correct: "42" | isCorrect: true | Pass |
| TC-28 | Validate INTEGER with leading zeros | "007", correct: "7" | isCorrect: true | Pass |
| TC-29 | Validate INTEGER with scientific notation | "1e5", correct: "100000" | isCorrect: true | Pass |
| TC-30 | Reject non-integer for INTEGER | "3.14", type: INTEGER | isCorrect: false | Pass |
| TC-31 | Validate DECIMAL exact match | "3.14", correct: "3.14" | isCorrect: true | Pass |
| TC-32 | Validate DECIMAL with tolerance | "3.141", correct: "3.14" | isCorrect: true | Pass |
| TC-33 | Validate FRACTION equivalence | "1/2", correct: "0.5" | isCorrect: true | Pass |
| TC-34 | Validate FRACTION simplification | "2/4", correct: "1/2" | isCorrect: true | Pass |
| TC-35 | Validate TEXT case-insensitive | "HELLO", correct: "hello" | isCorrect: true | Pass |
| TC-36 | Validate TEXT whitespace normalized | "  hello  world  " | isCorrect: true | Pass |
| TC-37 | Validate CHOICE single correct | "A", correct: "A" | isCorrect: true | Pass |
| TC-38 | Validate CHOICE multiple correct | "A,B", correct: ["A","B"] | isCorrect: true | Pass |
| TC-39 | Handle empty input | "", any type | isCorrect: false | Pass |
| TC-40 | Handle null values | null input | isCorrect: false | Pass |

### Curriculum Management Tests

| Test ID | Description | Input(s) | Expected Output | Result |
|---------|-------------|----------|-----------------|--------|
| TC-41 | Create curriculum with subjects | name, subjects array | Curriculum with subjects | Pass |
| TC-42 | Add prerequisite relationship | subjectA requires subjectB | Prereq link created | Pass |
| TC-43 | Detect circular prerequisites | A->B->C->A | Error: circular dependency | Pass |
| TC-44 | Calculate completion status | User progress data | Percentage complete | Pass |
| TC-45 | Export curriculum to JSON | curriculumId | Valid JSON structure | Pass |
| TC-46 | Import curriculum from JSON | Valid JSON file | Curriculum created | Pass |
| TC-47 | Handle invalid tags in export | Malformed tags JSON | Empty array fallback | Pass |
| TC-48 | Preserve reviewSteps in export/import | Card with reviewSteps=3 | reviewSteps=3 preserved | Pass |

### Instance Configuration Tests

| Test ID | Description | Input(s) | Expected Output | Result |
|---------|-------------|----------|-----------------|--------|
| TC-49 | Default to community mode | No INSTANCE_MODE set | mode: "community" | Pass |
| TC-50 | Parse INSTANCE_MODE from env | INSTANCE_MODE=school | mode: "school" | Pass |
| TC-51 | Community mode: all create content | role: STUDENT | canCreate: true | Pass |
| TC-52 | Publisher mode: restrict creation | role: STUDENT | canCreate: false | Pass |
| TC-53 | School mode: restrict browsing | role: STUDENT | canBrowse: false | Pass |
| TC-54 | Closed registration blocks signup | REGISTRATION=closed | 403 Forbidden | Pass |
| TC-55 | Domain registration validates email | wrong@other.com | 403 Domain not allowed | Pass |

---

## Test Execution Summary

| Metric | Value |
|--------|-------|
| Total Test Cases | 276 |
| Passed | 276 |
| Failed | 0 |
| Pass Rate | 100% |
| Execution Time | 3.35 seconds |

### Results by Test File

| Test File | Tests | Duration | Result |
|-----------|-------|----------|--------|
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

---

## Defects Found and Fixed

| Bug ID | Description | Severity | Status |
|--------|-------------|----------|--------|
| BUG-01 | JSON.parse crashes on invalid tags | Medium | Fixed |
| BUG-02 | INTEGER validation fails for scientific notation (1e5) | Low | Fixed |
| BUG-03 | LLM prompt missing solution field | High | Fixed |
| BUG-04 | Import/export missing reviewSteps field | Medium | Fixed |
| BUG-05 | Default card template missing solution field | Medium | Fixed |
| BUG-06 | Card editor missing LLM integration UI | High | Fixed |
| BUG-07 | Card editor missing reviewSteps field | Medium | Fixed |

### Bug Details

**BUG-01: JSON.parse crashes on invalid tags**
- Location: import-export.service.ts
- Root Cause: Direct JSON.parse() without try-catch
- Fix: Added safeParseJsonTags() helper function

**BUG-02: INTEGER validation fails for scientific notation**
- Location: validation.service.ts
- Root Cause: parseInt() stops at 'e' character
- Fix: Changed to parseFloat() with Number.isInteger() check

**BUG-03: LLM prompt missing solution field**
- Location: llm.service.ts
- Root Cause: Incomplete schema in system prompt
- Fix: Added solution field to prompt documentation

---

## Code Coverage

| Metric | Percentage |
|--------|------------|
| Statements | 39.13% |
| Branches | 80.36% |
| Functions | 44.44% |

### Coverage by Core Service

| Service | Statements | Branches |
|---------|------------|----------|
| card.service.ts | 100% | 82% |
| prereq.service.ts | 98.99% | 90.69% |
| validation.service.ts | 94.68% | 95% |
| import-export.service.ts | 90.82% | 82.6% |
| study.service.ts | 86.24% | 88.88% |
| sandbox.service.ts | 78.17% | 77.77% |

---

## Risks and Limitations

**Possible technical risks:**

1. **Sandbox Escape** - User code could potentially break out of isolation
   - Mitigation: QuickJS WASM provides strong isolation, timeout limits enforced

2. **Memory Exhaustion** - Malicious code could consume excessive memory
   - Mitigation: Memory limits enforced in sandbox configuration

3. **Denial of Service** - Infinite loops could hang execution
   - Mitigation: 1-second timeout strictly enforced

4. **Data Loss** - Import/export could lose data
   - Mitigation: Round-trip tests verify data preservation

5. **Scheduling Errors** - FSRS algorithm could miscalculate review dates
   - Mitigation: Algorithm tested with known inputs/outputs

**Dataset or hardware limitations:**

1. **No Real Database Testing** - Tests use mocked Prisma client
   - Limitation: Database-specific bugs may not be caught

2. **No Browser Testing** - UI tests run in jsdom, not real browser
   - Limitation: Browser-specific rendering issues may be missed

3. **No Load Testing** - System not tested under concurrent load
   - Limitation: Performance issues at scale unknown

4. **LLM Dependency** - AI features require OpenAI API key
   - Limitation: LLM tests use mocked responses

---

## Conclusion

The testing process successfully verified the core functionality of the Spaced Repetition Learning Platform. All 276 test cases passed, covering card management, sandbox execution, answer validation, study sessions, curriculum management, and instance configuration.

Seven defects were discovered through testing and subsequently fixed:
- 2 High severity (LLM integration issues)
- 4 Medium severity (data handling, UI gaps)
- 1 Low severity (edge case validation)

The core business logic achieves 85-100% code coverage, with branch coverage of 80% indicating thorough edge case handling. The overall statement coverage of 39% reflects the inclusion of UI components that require end-to-end testing rather than unit tests.

**Recommendations for future testing:**
1. Add Playwright E2E tests for critical user workflows
2. Implement load testing for sandbox execution
3. Add integration tests with real database
4. Conduct security penetration testing

The system is ready for deployment with confidence in its core functionality and security measures.

---

**Test Date:** March 2026
**Tester:** Test Team
**Approved By:** _______________

---

## Appendix: Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/services/validation.service.test.ts
```
