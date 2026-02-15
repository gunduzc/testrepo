/**
 * Test setup file for Vitest
 */

import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

// Mock Next.js headers
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));

// Mock environment variables
process.env.DATABASE_URL = "file:./test.db";
process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";
