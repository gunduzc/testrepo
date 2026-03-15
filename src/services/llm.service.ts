/**
 * LLMService - Handles LLM integration for card authoring and theming
 *
 * Features:
 * - Generate card functions from natural language descriptions
 * - Revise functions based on flagged samples
 * - Theme questions for personalized learning experience
 */

import OpenAI from "openai";
import { FlaggedSample } from "@/lib/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// System prompts for different tasks
const CARD_GENERATION_SYSTEM = `You are an expert at creating educational flashcard functions for a spaced repetition learning platform.

Your task is to generate JavaScript functions that produce question-answer pairs for students.

The function must:
1. Be named "generate"
2. Return an object with this exact structure:
   {
     question: string,  // The question text (supports Markdown and KaTeX)
     answer: {
       correct: string,  // The correct answer
       type: "INTEGER" | "DECIMAL" | "TEXT" | "FRACTION" | "CHOICE",
       choices?: string[],  // Required only for CHOICE type, must include correct answer
       validate?: string  // Optional custom validation function source
     },
     solution: string  // Explanation shown after answering (supports Markdown and KaTeX)
   }
3. Use Math.random() to generate varied questions
4. Be pure JavaScript (no require, no imports)
5. ALWAYS include a solution that explains how to solve the problem

Example for "two-digit addition":
function generate() {
  const a = Math.floor(Math.random() * 90) + 10;
  const b = Math.floor(Math.random() * 90) + 10;
  const sum = a + b;
  return {
    question: \`What is \${a} + \${b}?\`,
    answer: {
      correct: String(sum),
      type: "INTEGER"
    },
    solution: \`\${a} + \${b} = \${sum}\`
  };
}

For math notation, use KaTeX syntax:
- Inline: $x^2$ or \\(x^2\\)
- Block: $$x^2$$ or \\[x^2\\]

Respond with ONLY the JavaScript function, no explanation.`;

const CARD_REVISION_SYSTEM = `You are an expert at fixing educational flashcard functions.

Given a JavaScript function and flagged samples with issues, revise the function to fix the problems.

Common issues:
- Wrong answers (calculation errors)
- Invalid question format
- Edge cases not handled

Respond with ONLY the corrected JavaScript function, no explanation.`;

const THEMING_SYSTEM = `You are a creative writer who transforms educational questions into themed narratives.

Rules:
1. Keep the mathematical/educational content identical
2. Replace dry phrasing with theme-appropriate language
3. Never change the answer or question difficulty
4. Keep the question concise
5. Use the theme's style consistently

Example:
Theme: Space
Original: "What is 5 + 3?"
Themed: "Your spaceship needs 5 fuel cells, and you found 3 more in the asteroid. How many fuel cells do you have now?"

Respond with ONLY the themed question text, no explanation.`;

export class LLMService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!process.env.OPENAI_API_KEY;
  }

  /**
   * Generates a card function from a natural language description
   */
  async generateCardFunction(description: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error("LLM service not configured. Set OPENAI_API_KEY environment variable.");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CARD_GENERATION_SYSTEM },
        {
          role: "user",
          content: `Create a card function for: ${description}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    // Clean up code block markers if present
    return content
      .replace(/^```javascript\n?/i, "")
      .replace(/^```js\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
  }

  /**
   * Revises a card function based on flagged samples
   */
  async reviseCardFunction(
    source: string,
    flaggedSamples: FlaggedSample[]
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new Error("LLM service not configured. Set OPENAI_API_KEY environment variable.");
    }

    const flaggedInfo = flaggedSamples
      .map(
        (s, i) =>
          `Sample ${i + 1}:
Question: ${s.generatedQuestion}
Generated Answer: ${s.generatedAnswer}
${s.correctedAnswer ? `Correct Answer Should Be: ${s.correctedAnswer}` : ""}
${s.comment ? `Comment: ${s.comment}` : ""}`
      )
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CARD_REVISION_SYSTEM },
        {
          role: "user",
          content: `Current function:
\`\`\`javascript
${source}
\`\`\`

Flagged samples with issues:
${flaggedInfo}

Please fix the function to address these issues.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    return content
      .replace(/^```javascript\n?/i, "")
      .replace(/^```js\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
  }

  /**
   * Themes a question according to a theme's style
   */
  async themeQuestion(
    question: string,
    cardDescription: string,
    theme: { name: string; promptTemplate: string }
  ): Promise<string> {
    if (!this.isConfigured) {
      // Return original question if LLM not configured
      return question;
    }

    // Build prompt from template
    const prompt = theme.promptTemplate
      .replace("{question}", question)
      .replace("{description}", cardDescription);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Use faster model for theming
        messages: [
          { role: "system", content: THEMING_SYSTEM },
          {
            role: "user",
            content: `Theme: ${theme.name}\n\n${prompt}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      return content?.trim() || question;
    } catch {
      // Silent fallback to original question on error
      return question;
    }
  }

  /**
   * Check if the service is configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }
}

// Singleton instance
export const llmService = new LLMService();
