/**
 * Curriculum and subject related types
 */

/**
 * DTO for creating a curriculum
 */
export interface CreateCurriculumDTO {
  name: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * DTO for updating a curriculum
 */
export interface UpdateCurriculumDTO {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * DTO for creating a subject
 */
export interface CreateSubjectDTO {
  name: string;
  description?: string;
}

/**
 * DTO for updating a subject
 */
export interface UpdateSubjectDTO {
  name?: string;
  description?: string;
  cardIds?: string[]; // For reordering cards
}

/**
 * Subject with its cards and prerequisites
 */
export interface SubjectWithDetails {
  id: string;
  name: string;
  description?: string | null;
  cards: {
    cardId: string;
    position: number;
    card: {
      id: string;
      name: string;
      description: string;
      answerType: string;
    };
  }[];
  prerequisites: string[]; // IDs of prerequisite subjects
  dependents: string[]; // IDs of subjects that depend on this
}

/**
 * Curriculum with full structure
 */
export interface CurriculumWithStructure {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  authorId: string;
  subjects: SubjectWithDetails[];
}

/**
 * DAG validation result
 */
export interface DAGValidationResult {
  valid: boolean;
  cyclePath?: string[]; // Subject IDs forming the cycle, if any
}

/**
 * Prerequisite edge in the DAG
 */
export interface PrerequisiteEdge {
  subjectId: string;
  prerequisiteId: string;
}
