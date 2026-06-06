# Web Application Coding Standards

## 1. General Principles

Prioritize:
- readability
- maintainability
- testability
- security
- accessibility
- performance

Avoid:
- clever code
- hidden behavior
- excessive abstraction
- unnecessary dependencies

## 2. TypeScript / JavaScript Rules

Prefer:
- TypeScript
- explicit types for public APIs
- small functions
- clear naming
- validation at boundaries

Avoid:
- any unless justified
- deeply nested logic
- duplicated business logic
- unsafe type assertions

## 3. Frontend Rules

Prefer:
- small reusable components
- feature-based organization
- clear state ownership
- typed API clients
- accessible forms
- loading / empty / error states

Avoid:
- massive components
- business logic inside UI components
- duplicated API calls
- hidden global state

## 4. Backend Rules

Prefer:
- controller / service / repository separation
- input validation
- consistent error handling
- authentication middleware
- audit logging for sensitive actions

Avoid:
- business logic in controllers
- raw SQL without review
- unvalidated file uploads
- permission checks only on frontend

## 5. Security Rules

Always:
- validate inputs
- check permissions on backend
- sanitize file uploads
- protect secrets
- avoid logging sensitive data

Do not:
- trust frontend permissions
- expose internal errors
- commit .env files
- store plain-text passwords

## 6. Testing Rules

All major features should include:
- unit tests
- API tests
- E2E tests for critical flows
- permission tests
- upload/security tests

## 7. AI Collaboration Rules

AI-generated code must:
- be reviewed
- be tested
- include explanation when complex

Do not merge unreviewed AI-generated code.

## 8. Git Rules

Use:
- small commits
- clear commit messages
- isolated changes

Avoid:
- unrelated modifications
- force push
- silent rewrites

## 9. Documentation Rules

Update docs when:
- API changes
- database schema changes
- auth/permission changes
- major systems are added
