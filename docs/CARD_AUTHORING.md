# Card Authoring Guide

Cards are JavaScript functions that generate question-answer pairs. This guide explains how to create effective cards.

## Basic Structure

Every card must export a `generate` function that returns an object with this structure:

```javascript
function generate() {
  return {
    question: "string",  // Markdown + KaTeX supported
    answer: {
      correct: "string",
      type: "INTEGER" | "DECIMAL" | "TEXT" | "FRACTION" | "CHOICE",
      choices: ["string"],  // Required only for CHOICE type
      validate: "string"    // Optional custom validation function
    }
  };
}
```

## Answer Types

### INTEGER
Whole numbers. Leading zeros and whitespace are ignored.
```javascript
function generate() {
  const a = Math.floor(Math.random() * 100);
  const b = Math.floor(Math.random() * 100);
  return {
    question: `What is ${a} + ${b}?`,
    answer: { correct: String(a + b), type: "INTEGER" }
  };
}
```

### DECIMAL
Floating point numbers. Uses epsilon comparison (1e-9).
```javascript
function generate() {
  const radius = Math.floor(Math.random() * 10) + 1;
  const area = Math.PI * radius * radius;
  return {
    question: `A circle has radius ${radius}. What is its area? (round to 2 decimals)`,
    answer: { correct: area.toFixed(2), type: "DECIMAL" }
  };
}
```

### TEXT
Case-insensitive, whitespace-trimmed comparison.
```javascript
function generate() {
  const capitals = [
    { country: "France", capital: "Paris" },
    { country: "Germany", capital: "Berlin" },
    { country: "Japan", capital: "Tokyo" }
  ];
  const item = capitals[Math.floor(Math.random() * capitals.length)];
  return {
    question: `What is the capital of ${item.country}?`,
    answer: { correct: item.capital, type: "TEXT" }
  };
}
```

### FRACTION
Automatically reduced to lowest terms. "4/6" = "2/3".
```javascript
function generate() {
  const num1 = Math.floor(Math.random() * 5) + 1;
  const den1 = Math.floor(Math.random() * 5) + 2;
  const num2 = Math.floor(Math.random() * 5) + 1;
  const den2 = Math.floor(Math.random() * 5) + 2;

  // Add fractions
  const resultNum = num1 * den2 + num2 * den1;
  const resultDen = den1 * den2;

  return {
    question: `What is $\\frac{${num1}}{${den1}} + \\frac{${num2}}{${den2}}$? (as a fraction)`,
    answer: { correct: `${resultNum}/${resultDen}`, type: "FRACTION" }
  };
}
```

### CHOICE
Multiple choice. Choices array must include the correct answer.
```javascript
function generate() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const correct = a * b;

  // Generate wrong answers
  const choices = [
    String(correct),
    String(correct + a),
    String(correct - b),
    String(a + b)
  ].sort(() => Math.random() - 0.5);

  return {
    question: `What is ${a} × ${b}?`,
    answer: { correct: String(correct), type: "CHOICE", choices }
  };
}
```

## Using KaTeX for Math

Use LaTeX syntax for mathematical notation:

```javascript
function generate() {
  const n = Math.floor(Math.random() * 5) + 2;
  return {
    question: `Simplify: $x^{${n}} \\cdot x^{${n}}$`,
    answer: { correct: String(n * 2), type: "INTEGER" }
  };
}
```

Common KaTeX:
- Inline: `$x^2$` or `\\(x^2\\)`
- Block: `$$x^2$$` or `\\[x^2\\]`
- Fractions: `\\frac{a}{b}`
- Square roots: `\\sqrt{x}`
- Subscripts: `x_{n}`
- Greek letters: `\\alpha`, `\\beta`, `\\pi`

## Custom Validation

For complex answer validation, provide a custom function:

```javascript
function generate() {
  const target = Math.floor(Math.random() * 100);
  return {
    question: `Enter any number between ${target - 10} and ${target + 10}:`,
    answer: {
      correct: String(target),  // Reference answer
      type: "INTEGER",
      validate: `
        function validate(input) {
          const num = parseInt(input);
          return num >= ${target - 10} && num <= ${target + 10};
        }
      `
    }
  };
}
```

## Available APIs

Inside card functions, you have access to:
- `Math.random()` - Random numbers
- `Math.floor()`, `Math.ceil()`, `Math.round()`
- `Math.abs()`, `Math.min()`, `Math.max()`
- `Math.pow()`, `Math.sqrt()`
- `Math.PI`, `Math.E`
- Standard JavaScript (no imports/require)

## Constraints

- **Memory**: 8 MB heap limit
- **Time**: 1 second timeout
- **No external access**: No require, fs, network
- **Must be deterministic-ish**: Use Math.random() for variation

## Best Practices

1. **Vary difficulty naturally** through number ranges and complexity
2. **Generate unique questions** each time to prevent memorization
3. **Use clear question wording** that unambiguously specifies the expected answer
4. **Test thoroughly** with the preview feature before saving
5. **Include edge cases** in your random generation
6. **Keep questions focused** on a single concept

## LLM-Assisted Authoring

Educators can describe cards in natural language and have the LLM generate the function:

1. Enter description: "Subtraction of two-digit numbers, result always positive"
2. LLM generates function
3. Review 10 sample outputs
4. Flag any incorrect samples with corrections
5. Request revision
6. Approve and save with full authoring history
