/**
 * Central export for all types
 */

// Enums
export * from "./enums";

// Card types
export * from "./card";

// Study types
export * from "./study";

// Curriculum types
export * from "./curriculum";

// Import/Export types
export * from "./import-export";

// FSRS types
export * from "./fsrs";

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
