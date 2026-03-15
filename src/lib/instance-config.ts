/**
 * Instance Configuration
 *
 * INSTANCE_MODE determines the type of deployment:
 * - community: Everyone can create content, open browse
 * - publisher: Educators create, everyone studies, open browse
 * - school: Educators create, students see only assigned content
 *
 * REGISTRATION determines how users join:
 * - open: Anyone can sign up
 * - domain: Only emails from allowed domains
 * - sso: SSO only (no password registration)
 * - invite: Invite link required
 * - code: Registration code required
 *
 * PREREQ_ENFORCEMENT determines prerequisite strictness:
 * - hard: Block enrollment until prereqs completed
 * - soft: Warning, but allow continuation
 * - none: Informational only
 */

export type InstanceMode = 'community' | 'publisher' | 'school';
export type RegistrationMode = 'open' | 'closed' | 'domain' | 'sso' | 'invite' | 'code';
export type PrereqEnforcement = 'hard' | 'soft' | 'none';

// Get instance mode from environment
export function getInstanceMode(): InstanceMode {
  const mode = process.env.INSTANCE_MODE?.toLowerCase();
  if (mode === 'community' || mode === 'publisher' || mode === 'school') {
    return mode;
  }
  return 'community'; // Default
}

// Get registration mode from environment
export function getRegistrationMode(): RegistrationMode {
  const mode = process.env.REGISTRATION?.toLowerCase();
  if (mode === 'open' || mode === 'closed' || mode === 'domain' || mode === 'sso' || mode === 'invite' || mode === 'code') {
    return mode;
  }
  // Default based on instance mode
  const instanceMode = process.env.INSTANCE_MODE?.toLowerCase();
  return instanceMode === 'school' ? 'closed' : 'open';
}

// Get allowed email domains (for domain registration mode)
export function getAllowedDomains(): string[] {
  const domains = process.env.ALLOWED_DOMAINS;
  if (!domains) return [];
  return domains.split(',').map(d => d.trim().toLowerCase());
}

// Get prereq enforcement level
export function getPrereqEnforcement(): PrereqEnforcement {
  const explicit = process.env.PREREQ_ENFORCEMENT?.toLowerCase();
  if (explicit === 'hard' || explicit === 'soft' || explicit === 'none') {
    return explicit;
  }
  // Default based on mode
  const mode = getInstanceMode();
  return mode === 'school' ? 'hard' : 'soft';
}

// Permission checks based on instance mode

/**
 * Can this user create content (curricula, subjects, cards)?
 */
export function canCreateContent(role: string): boolean {
  const mode = getInstanceMode();

  switch (mode) {
    case 'community':
      // Everyone can create in community mode
      return true;
    case 'publisher':
    case 'school':
      // Only educators and admins can create
      return role === 'EDUCATOR' || role === 'ADMIN';
    default:
      return false;
  }
}

/**
 * Can this user browse the public library?
 */
export function canBrowseLibrary(role: string, hasClassEnrollment: boolean): boolean {
  const mode = getInstanceMode();

  switch (mode) {
    case 'community':
    case 'publisher':
      // Everyone can browse in community/publisher modes
      return true;
    case 'school':
      // In school mode, students only see assigned content
      // Educators and admins can browse
      if (role === 'EDUCATOR' || role === 'ADMIN') {
        return true;
      }
      // Students can only browse if they have no class enrollment
      // (edge case: new students before being added to a class)
      return !hasClassEnrollment;
    default:
      return false;
  }
}

/**
 * Should we show classes UI?
 */
export function showClassesUI(): boolean {
  return getInstanceMode() === 'school';
}

/**
 * Does the Educator role exist meaningfully in this mode?
 */
export function hasEducatorRole(): boolean {
  const mode = getInstanceMode();
  // In community mode, everyone creates, so Educator is just Admin-lite
  return mode !== 'community';
}

/**
 * Get instance config summary for client
 */
export function getInstanceConfig() {
  return {
    mode: getInstanceMode(),
    registration: getRegistrationMode(),
    prereqEnforcement: getPrereqEnforcement(),
    showClasses: showClassesUI(),
    hasEducatorRole: hasEducatorRole(),
  };
}
