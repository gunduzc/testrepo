# Development Notes

## Future Features

### Registration Modes (Not Yet Implemented)

#### Invite Mode (`REGISTRATION=invite`)
- Generate unique invite links for user registration
- Links could be single-use or multi-use
- Optional expiration dates
- Track who invited whom
- Useful for: controlled growth, referral tracking

#### Code Mode (`REGISTRATION=code`)
- Require a registration code to sign up
- Codes could be per-class, per-cohort, or per-event
- Bulk code generation for administrators
- Optional usage limits per code
- Useful for: workshops, courses, cohort-based programs

### Classes Feature (School Mode)
- Class management UI for educators
- Assign curricula/subjects to classes
- Student roster management
- Class-level progress tracking
- Currently: `showClassesUI()` returns true for school mode, but UI not built

## Completed

- [x] Instance modes (community/publisher/school)
- [x] Registration modes (open/closed/domain)
- [x] Role-based permissions (STUDENT/EDUCATOR/ADMIN)
- [x] Prerequisite enforcement (hard/soft/none)
- [x] LLM card generation integration
- [x] Registration security (no self-role selection)
