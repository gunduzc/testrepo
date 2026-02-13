# Setup Guide

## Prerequisites

- Node.js 18+ (or use nix)
- SQLite (included, no setup needed)
- Optional: OpenAI API key for LLM features

## Installation

### Using Nix (NixOS)

```bash
# Clone the repository
cd /path/to/platform

# Enter development shell with Node.js
nix shell nixpkgs#nodejs_20

# Install dependencies
npm install

# Set up database
nix shell nixpkgs#prisma -c prisma db push
nix shell nixpkgs#prisma -c prisma generate

# Start development server
npm run dev
```

### Standard Installation

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Set up database
npx prisma db push
npx prisma generate

# Start development server
npm run dev
```

## Environment Variables

Create a `.env` file:

```env
# Database (SQLite for development)
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secure-secret"

# 2FA encryption key
TWO_FACTOR_SECRET_KEY="generate-another-secure-secret"

# OpenAI API (optional, for LLM features)
OPENAI_API_KEY="sk-..."
```

Generate secure secrets:
```bash
openssl rand -base64 32
```

## Database Setup

### Development (SQLite)
```bash
# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# View data (optional)
npx prisma studio
```

### Production (PostgreSQL)
Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Update `.env`:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
```

Then:
```bash
npx prisma migrate deploy
npx prisma generate
```

## Creating an Admin User

After starting the app:

1. Register a new account via `/register`
2. Update the user's role via Prisma Studio or database:

```bash
npx prisma studio
# Navigate to User table, find your user, change role to "ADMIN"
```

Or via SQL:
```sql
UPDATE User SET role = 'ADMIN' WHERE email = 'your@email.com';
```

## Running the Application

### Development
```bash
npm run dev
```
App available at http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

### With Nix
```bash
nix shell nixpkgs#nodejs_20 -c npm run dev
```

## Testing Card Functions

1. Log in as EDUCATOR or ADMIN
2. Navigate to `/editor`
3. Write a card function
4. Click "Test (10 samples)" to preview outputs
5. Fix any errors shown in the preview panel

## Troubleshooting

### Prisma on NixOS
If Prisma commands fail on NixOS:
```bash
# Use nix-packaged prisma for CLI commands
nix shell nixpkgs#prisma -c prisma <command>

# You may need to ignore checksum errors
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 nix shell nixpkgs#prisma -c prisma generate
```

The build may show Prisma engine warnings during static page generation - this is normal on NixOS and doesn't affect the runtime application.

### isolated-vm Build Errors
The `isolated-vm` package requires native compilation. On some systems:
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# macOS
xcode-select --install
```

### KaTeX CSS Not Loading
Ensure the layout imports KaTeX CSS:
```tsx
import "katex/dist/katex.min.css";
```

### LLM Features Not Working
- Check that `OPENAI_API_KEY` is set in `.env`
- Verify API key is valid at OpenAI dashboard
- LLM features gracefully degrade if not configured

## Project Structure Quick Reference

```
src/
├── app/api/          # API routes
├── app/(auth)/       # Auth pages
├── app/study/        # Study interface
├── app/editor/       # Card editor
├── app/dashboard/    # User dashboard
├── components/       # React components
├── lib/              # Shared utilities
└── services/         # Business logic
```
