# Bugs Found During Testing

This document records bugs discovered through automated testing and their fixes.

## Summary

| Bug ID | Description | Severity | Status |
|--------|-------------|----------|--------|
| BUG-01 | JSON.parse crashes on invalid tags | Medium | Fixed |
| BUG-02 | INTEGER validation fails for scientific notation | Low | Fixed |

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
Test Files  14 passed (14)
     Tests  263 passed (263)
```

All tests pass after applying the fixes.

---

## Lessons Learned

1. **Always handle JSON parsing errors** - External data (database fields, user input, imported files) may contain invalid JSON. Always wrap `JSON.parse()` in try-catch.

2. **Be aware of JavaScript number parsing quirks** - `parseInt()` and `parseFloat()` behave differently with scientific notation. Choose the appropriate function based on expected input formats.

3. **Write edge case tests** - These bugs were discovered by writing tests for unusual but valid inputs (malformed data, scientific notation). Edge case testing reveals bugs that normal testing misses.
