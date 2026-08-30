# ForgePilot Testing Guide

## Commands

- `npm test`: build ForgePilot and run the complete automated test suite.
- `npm run test:api`: explicit alias for the same API integration suite.

The API suite starts the built ForgePilot server on an available local port, uses a fresh
temporary SQLite database, and replaces GitLab with a local HTTP mock. It never reads
the development database, a real GitLab Token, or an external GitLab instance. Test
processes and temporary files are removed when the suite completes.

## API Test Requirement

Every new or changed endpoint under `server/api/` must include a matching HTTP
integration test in `tests/api/`. The test must call the real route and verify:

1. the successful status and response contract;
2. important validation and project-boundary failures;
3. persistence or cascade side effects when the endpoint changes stored data;
4. provider behavior through a local mock rather than a real external system.

The API suite discovers the route files and compares them with the tested route cases.
Adding an endpoint without a matching route case makes `npm test` fail. Keep test data
isolated and never place credentials or production data in fixtures.

Use Node.js 22.19 or newer, matching the application runtime requirement.
