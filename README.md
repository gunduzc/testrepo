# Programmable Spaced Repetition Learning Platform

A type-safe, layered architecture learning platform using the FSRS (Free Spaced Repetition Scheduler) algorithm. Create programmable flashcards with JavaScript, organize them into curricula with prerequisite-based unlocking, and track student progress.

## Features

### For Students
- **Optimized Learning**: FSRS algorithm adapts to your memory patterns
- **Prerequisite-Based Unlocking**: Subjects unlock as you master prerequisites
- **Theme Support**: Personalize questions with different themes (Space, Fantasy, etc.)
- **Progress Tracking**: Detailed stats per subject and curriculum

### For Educators
- **Programmable Cards**: Write JavaScript functions that generate infinite question variations
- **LLM-Assisted Authoring**: Describe cards in natural language, AI generates the code
- **Visual Curriculum Editor**: Build DAGs of subjects with prerequisites
- **Class Management**: Group students, assign curricula, track progress
- **Import/Export**: JSON-based curriculum sharing

### Security
- **Sandboxed Execution**: Card code runs in isolated V8 instances
- **Server-Side Validation**: Correct answers never leave the server
- **Role-Based Access**: Admin, Educator, and Student roles
- **2FA Support**: TOTP-based two-factor authentication

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: Prisma
- **Auth**: NextAuth.js v5
- **Scheduling**: ts-fsrs
- **Sandbox**: isolated-vm
- **LLM**: OpenAI API (optional)
- **Styling**: Tailwind CSS

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Initialize database
npx prisma db push
npx prisma generate

# Start development server
npm run dev
```

Visit http://localhost:3000

## Documentation

- [Setup Guide](docs/SETUP.md) - Installation and configuration
- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [API Reference](docs/API.md) - Complete API documentation
- [Card Authoring](docs/CARD_AUTHORING.md) - How to create flashcard functions
- [LLD Report](LLD_Report.md) - Original low-level design specification

## Example Card Function

```javascript
function generate() {
  const a = Math.floor(Math.random() * 90) + 10;
  const b = Math.floor(Math.random() * 90) + 10;

  return {
    question: `What is $${a} + ${b}$?`,
    answer: {
      correct: String(a + b),
      type: "INTEGER"
    }
  };
}
```

## Project Status

This is a Senior Design Project (February 2026) implementing the full LLD specification:

- [x] Prisma database schema
- [x] Core services (Sandbox, FSRS, Validation, LLM, etc.)
- [x] REST API routes
- [x] NextAuth authentication with 2FA
- [x] Study interface with FSRS scheduling
- [x] Card code editor with preview
- [x] Curriculum browser and enrollment
- [x] Student/Educator dashboards
- [ ] Visual DAG editor (ReactFlow)
- [ ] Full class management UI
- [ ] FSRS parameter optimization UI
- [ ] Theme selection UI

## License

This project is part of a university senior design course.

---

Built with Next.js, Prisma, and ts-fsrs.
