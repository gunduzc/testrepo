# Bugs Found During Testing

This document records bugs discovered through automated testing and their fixes.

## Summary

| Bug ID | Description | Severity | Status |
|--------|-------------|----------|--------|
| BUG-01 | JSON.parse crashes on invalid tags | Medium | Fixed |
| BUG-02 | INTEGER validation fails for scientific notation | Low | Fixed |
| BUG-03 | LLM prompt missing solution field | High | Fixed |
| BUG-04 | Import/export missing reviewSteps field | Medium | Fixed |

---

## BUG-01: JSON.parse crashes on invalid tags

### Test Case
TC-31: should handle card with invalid tags JSON gracefully

### Description
The `exportCard()` function in `import-export.service.ts` used `JSON.parse(card.tags)` without error handling. If a card somehow had malformed JSON in the tags field (e.g., database corruption, manual edit), the entire export operation would crash with an unhandled exception.

### Location
- **File:** `src/services/import-export.service.ts`
- **Line:** 38 (and similar patterns at lines 80, 122)
- **Function:** `exportCard()`, `exportSubject()`, `exportCurriculum()`

### Steps to Reproduce
1. Create a card with invalid JSON in the tags field (e.g., `"not valid json"`)
2. Call `exportCard(cardId)`
3. Observe: `SyntaxError: Unexpected token 'o', "not valid json" is not valid JSON`

### Root Cause
Direct use of `JSON.parse()` without try-catch error handling:
```typescript
// Before (buggy)
tags: JSON.parse(card.tags) as string[]
```

### Fix
Added a helper function `safeParseJsonTags()` that catches parse errors and returns an empty array as a safe fallback:

```typescript
/**
 * Safely parse tags JSON, returning empty array on failure
 */
function safeParseJsonTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    return JSON.parse(tags) as string[];
  } catch {
    return [];
  }
}
```

Updated all three export functions to use this helper:
```typescript
// After (fixed)
tags: safeParseJsonTags(card.tags)
```

### Verification
```
✓ should handle card with invalid tags JSON gracefully
✓ should handle card with null tags
```

---

## BUG-02: INTEGER validation fails for scientific notation

### Test Case
TC-32: should handle scientific notation for INTEGER type

### Description
The `normalizeInteger()` function in `validation.service.ts` used `parseInt()` which does not correctly parse scientific notation. When a student entered `"1e5"` (meaning 100,000), it was parsed as `1` instead of `100000`, causing incorrect validation.

### Location
- **File:** `src/services/validation.service.ts`
- **Line:** 71-75
- **Function:** `normalizeInteger()`

### Steps to Reproduce
1. Create a card with correct answer `"100000"` and type `INTEGER`
2. Student submits answer `"1e5"`
3. Expected: Correct (1e5 = 100000)
4. Actual: Incorrect (parsed as 1)

### Root Cause
`parseInt()` stops parsing at the first non-numeric character:
```typescript
// Before (buggy)
function normalizeInteger(input: string): number | null {
  const trimmed = input.trim();
  const num = parseInt(trimmed, 10);  // parseInt("1e5", 10) = 1
  return isNaN(num) ? null : num;
}
```

### Fix
Changed to use `parseFloat()` which correctly handles scientific notation, with an additional `Number.isInteger()` check to ensure the result is actually an integer:

```typescript
// After (fixed)
function normalizeInteger(input: string): number | null {
  const trimmed = input.trim();
  const num = parseFloat(trimmed);  // parseFloat("1e5") = 100000
  if (isNaN(num) || !isFinite(num)) return null;
  if (!Number.isInteger(num)) return null;  // Reject 3.14
  return num;
}
```

### Verification
```
✓ should handle scientific notation (1e5 = 100000)
✓ should reject float input for INTEGER type (3.14 rejected)
✓ should handle very large integers
```

---

## Test Results After Fixes

```
Test Files  15 passed (15)
     Tests  276 passed (276)
```

All tests pass after applying the fixes.

---

---

## BUG-03: LLM prompt missing solution field

### Test Case
TC-33: System prompt should include solution field

### Description
The LLM system prompt for card generation did not include the required `solution` field in its documentation. When the LLM generated cards, they would be missing the `solution` field, causing them to fail sandbox validation.

### Location
- **File:** `src/services/llm.service.ts`
- **Line:** 18-54 (CARD_GENERATION_SYSTEM prompt)

### Root Cause
The prompt documentation showed the card structure without the `solution` field:
```typescript
// Before (buggy)
{
  question: string,
  answer: { correct: string, type: "..." }
}
```

### Fix
Updated the prompt to include the `solution` field and emphasized its requirement:

```typescript
// After (fixed)
{
  question: string,
  answer: { correct: string, type: "..." },
  solution: string  // Explanation shown after answering
}
```

Also added rule: "ALWAYS include a solution that explains how to solve the problem"

### Verification
```
✓ should include solution field in generation prompt
✓ System prompt validation tests pass
```

---

## BUG-04: Import/export missing reviewSteps field

### Test Case
TC-34: Export should include all card fields

### Description
The `reviewSteps` field (added for custom step-based learning) was missing from:
1. `CardExportJSON` type definition
2. `exportCard()`, `exportSubject()`, `exportCurriculum()` functions
3. `importCard()`, `importSubject()`, `importCurriculum()` functions

When exporting and re-importing cards, the `reviewSteps` setting would be lost.

### Location
- **Files:**
  - `src/lib/types/import-export.ts`
  - `src/services/import-export.service.ts`

### Root Cause
When `reviewSteps` was added to the Card model, the import-export system was not updated.

### Fix
1. Added `reviewSteps: number` to `CardExportJSON` interface
2. Added `reviewSteps` to all export functions
3. Added `reviewSteps` to all import functions

```typescript
// Added to CardExportJSON
reviewSteps: number;

// Added to export functions
reviewSteps: card.reviewSteps,

// Added to import functions
reviewSteps: data.data.reviewSteps,
```

### Verification
```
✓ Export includes reviewSteps
✓ Import preserves reviewSteps
```

---

## Lessons Learned

1. **Always handle JSON parsing errors** - External data (database fields, user input, imported files) may contain invalid JSON. Always wrap `JSON.parse()` in try-catch.

2. **Be aware of JavaScript number parsing quirks** - `parseInt()` and `parseFloat()` behave differently with scientific notation. Choose the appropriate function based on expected input formats.

3. **Write edge case tests** - These bugs were discovered by writing tests for unusual but valid inputs (malformed data, scientific notation). Edge case testing reveals bugs that normal testing misses.

4. **Keep prompts in sync with schemas** - When integrating with LLMs, ensure system prompts accurately document the expected output schema. Schema changes must be reflected in prompts.

5. **Update all related code when adding fields** - When adding a new field to a model (like `reviewSteps`), search for all places that serialize/deserialize that model (import, export, API responses) and update them together.

6. **Integration tests catch what unit tests miss** - The `reviewSteps` bug was found by testing the full import-export flow, not just individual functions.
