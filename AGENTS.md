## 1. Project Context

AgriBridge is a technology-driven agricultural platform intended to bridge the gap between agriculture and modern digital solutions.

The complete project requirements, specifications, architecture and development guidelines are maintained in the `docs/` directory.

This repository is the central source of truth for the project.

## 2. Mandatory Documentation Rules

Before implementing any feature or making significant architectural changes:

1. Read the relevant project documentation in `docs/`.
2. Understand the existing application structure.
3. Check existing implementations before creating new ones.
4. Follow the approved functional and technical requirements.
5. Identify missing or conflicting requirements before proceeding.

Do not invent major features, workflows or architectural decisions.

If an important requirement is unclear or missing, ask for clarification rather than making an irreversible assumption.

## 3. Development Principles

All development must prioritize:

- Security and data protection.
- Maintainable and modular code.
- Scalability and performance.
- Reliability and error handling.
- Accessibility and responsive design.
- Clear separation of responsibilities.
- Reusable components and consistent coding practices.

Avoid unnecessary complexity, duplicate code and premature optimization.

## 4. Technology Stack

The technology stack must be established through the approved technical architecture documentation.

Do not independently introduce or replace major frameworks, programming languages, databases or infrastructure technologies without authorization.

Use compatible and actively maintained dependencies.

## 5. Application Architecture

Follow the architecture defined in the project documentation.

Maintain clear separation between frontend, backend, database, external integrations and AI-related services wherever applicable.

Do not place sensitive business logic or secret credentials in publicly accessible frontend code.

## 6. Security Requirements

Security must be considered in every implementation.

- Never hardcode API keys, passwords or secret credentials.
- Use environment variables or appropriate secret management.
- Never store user passwords in plain text.
- Implement appropriate authentication and authorization.
- Validate and sanitize untrusted user inputs.
- Protect sensitive data.
- Apply secure API and database access practices.
- Avoid exposing internal errors or sensitive information to users.

Follow the detailed security requirements documented in `docs/`.

## 7. Coding Standards

- Write readable, modular and well-organized code.
- Use meaningful names for files, variables, functions and components.
- Avoid unnecessary duplication.
- Handle errors appropriately.
- Add comments where they improve understanding.
- Follow the established project conventions.
- Do not introduce unnecessary dependencies.

## 8. Testing and Verification

Before considering an implementation complete:

1. Run the relevant tests.
2. Check for compilation and build errors.
3. Verify expected functionality.
4. Check relevant edge cases.
5. Verify that existing functionality has not been unnecessarily broken.

Add or update tests when introducing new functionality.

Never claim that something has been tested successfully unless the relevant checks have actually been performed.

## 9. Change Management

Before making significant changes:

- Inspect the affected files.
- Understand their dependencies.
- Consider possible side effects.
- Preserve existing working functionality.

Do not delete, overwrite or substantially restructure existing code without a valid reason.

Do not silently change approved requirements.

## 10. Documentation Maintenance

When implementing or changing functionality:

- Update relevant technical documentation when necessary.
- Keep documentation consistent with the actual implementation.
- Update setup instructions when development requirements change.
- Document important architectural decisions.

Do not create unnecessary documentation files.

## 11. Development Workflow

For each assigned task:

1. Understand the requested task.
2. Read relevant documentation.
3. Inspect the existing implementation.
4. Identify the files and components involved.
5. Plan the implementation.
6. Implement the changes.
7. Run appropriate tests and verification.
8. Report the files changed, implementation details, test results and any remaining limitations.

## 12. Scope Control

Only implement functionality that is:

- Explicitly requested, or
- Clearly established in the approved project documentation.

Do not independently expand project scope or introduce unrelated features.

When requirements conflict, stop and seek clarification.

## Final Instruction

Treat AgriBridge as a long-term software engineering project, not a disposable prototype.

Prioritize correctness, security, maintainability and adherence to documented requirements over speed or unnecessary complexity.
