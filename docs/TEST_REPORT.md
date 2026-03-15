# Test Report

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Test Cases | 276 |
| Test Files | 15 |
| Pass Rate | 100% |
| Bugs Found | 7 |
| Bugs Fixed | 7 |
| Statement Coverage | 39.13% |
| Branch Coverage | 80.36% |
| Function Coverage | 44.44% |

## Test Environment

| Component | Version/Details |
|-----------|-----------------|
| Framework | Next.js 16 with React 19 |
| Test Runner | Vitest 2.1.9 |
| Coverage Tool | V8 |
| Database | PostgreSQL (Neon) via Prisma ORM |
| Sandbox | QuickJS WASM (secure JS execution) |
| CI/CD | Vercel |

## Test Categories

### 1. Unit Tests - Services

| Service | Tests | Coverage |
|---------|-------|----------|
| validation.service.ts | 49 | 94.68% |
| sandbox.service.ts | 25 | 78.17% |
| fsrs.service.ts | 22 | 73.47% |
| curriculum.service.ts | 22 | 48.61% |
| card.service.ts | 21 | 100% |
| study.service.ts | 21 | 86.24% |
| import-export.service.ts | 21 | 90.82% |
| prereq.service.ts | 18 | 98.99% |
| llm.service.ts | 13 | 37.16% |

### 2. Integration Tests - API Routes

| Route | Tests | Description |
|-------|-------|-------------|
| /api/cards | 8 | Card CRUD operations |
| /api/cards/test | 7 | Sandbox execution |
| /api/study | 10 | Study session management |
| /api/curricula | 5 | Curriculum management |

### 3. Component Tests

| Component | Tests | Description |
|-----------|-------|-------------|
| answer-input.tsx | 11 | User input handling for all answer types |
| instance-config.ts | 23 | Instance mode configuration |

## Bugs Discovered

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| BUG-01 | Medium | JSON.parse crashes on invalid tags | Fixed |
| BUG-02 | Low | INTEGER validation fails for scientific notation | Fixed |
| BUG-03 | High | LLM prompt missing solution field | Fixed |
| BUG-04 | Medium | Import/export missing reviewSteps field | Fixed |
| BUG-05 | Medium | Default card template missing solution field | Fixed |
| BUG-06 | High | Card editor missing LLM integration UI | Fixed |
| BUG-07 | Medium | Card editor missing reviewSteps field | Fixed |

See `docs/test-bug-fixes.md` for detailed root cause analysis and fixes.

## Test Case Summary by Feature

### Card Management (TC-01 to TC-15)
- TC-01: Create card with valid data
- TC-02: Reject card without authentication
- TC-03: Reject card with missing fields
- TC-04: Reject card with invalid answer type
- TC-05: Validate function source syntax
- TC-06: Test sandbox execution success
- TC-07: Test sandbox timeout handling
- TC-08: Test sandbox memory limit
- TC-09 to TC-15: Card testing endpoint

### Study Session (TC-16 to TC-25)
- TC-16: Start study session
- TC-17: Get next question
- TC-18: Submit correct answer
- TC-19: Submit incorrect answer
- TC-20: Handle session completion
- TC-21 to TC-25: Edge cases and error handling

### Curriculum Management (TC-26 to TC-30)
- TC-26: Create curriculum
- TC-27: List curricula
- TC-28: Curriculum prerequisites
- TC-29: Enrollment logic
- TC-30: Public/private visibility

### Validation (TC-31 to TC-49)
- TC-31: Invalid JSON tags handling
- TC-32: Scientific notation for INTEGER
- TC-33 to TC-49: All answer type validations

## Coverage Analysis

### Well-Covered Areas (>80%)
- Card service (100%)
- Prereq service (98.99%)
- Validation service (94.68%)
- Import-export service (90.82%)

### Areas for Improvement (<50%)
- LLM service (37.16%) - External API, mocked
- Curriculum service (48.61%) - Complex workflows
- UI components (varies) - Require E2E testing

## Test Execution

```
 Test Files  15 passed (15)
      Tests  276 passed (276)
   Duration  3.35s
```

## Methodology

1. **Test-Driven Bug Discovery**: Wrote tests for edge cases, found real bugs
2. **Mocking Strategy**: Database (Prisma), external APIs (OpenAI), sandbox (QuickJS)
3. **Coverage-Guided Testing**: Used V8 coverage to identify untested paths
4. **Security Testing**: Verified role-based access, input validation

## Recommendations

1. Add E2E tests with Playwright for UI workflows
2. Increase curriculum.service coverage with integration tests
3. Add load testing for sandbox execution
4. Implement mutation testing for validation logic

## Appendix

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- src/services/validation.service.test.ts
```

### Git Commits (Testing Phase)

| Commit | Description |
|--------|-------------|
| 910d59b | Add comprehensive test coverage for core services |
| 58e3745 | Fix registration security: remove self-role selection |
| f9df533 | Add NOTES.md with future feature ideas |
