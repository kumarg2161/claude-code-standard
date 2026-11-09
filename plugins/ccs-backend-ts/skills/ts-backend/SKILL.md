---
name: ts-backend
description: Use when writing, reviewing or planning a TypeScript/Node backend (Fastify, Express, NestJS, Hono): routes and handlers, request validation, error handling, services and repositories, config, logging, Vitest + supertest tests, or generating shared types from an OpenAPI contract.
---

# TypeScript backend conventions

First detect what the repo already uses (`package.json`: fastify, express, @nestjs/core, hono; prisma, drizzle, typeorm, kysely; vitest or jest).
**Follow the existing framework and style. Never introduce a second one.**

## Structure (per feature module)
`route/controller` (HTTP only) -> `service` (business rules, no HTTP types) -> `repository` (all DB access). Handlers contain no business logic and
no SQL. A service never imports a framework request/response type.

## Boundaries (constitution Articles B-1..B-3)
- **Validate at the boundary.** Every request body, query, params and header set is parsed by a zod (or framework-native) schema before use.
  Derive handler types from the schema (`z.infer`), do not hand-write them twice.
- **One error envelope**, `{ "error": { "code", "message", "details" } }`, produced in a single error handler. Throw typed errors
  (`NotFoundError`, `ValidationError`, `ConflictError`) from services; map to status codes once. Never `catch` and return `[]`/`null`/`{}`.
- **Contract first.** The endpoint exists in `specs/<feature>/contracts/openapi.yaml` before code. Generate or check types against it
  (`openapi-typescript` into `packages/shared-types`); a handler whose response differs from the contract is a bug.
- **Config from env**, parsed once at startup by a schema; the process fails fast on bad config. No `process.env` reads elsewhere. Never log secrets or PII.
- **Data:** parameterised queries only; every lookup handles "not found"; multi-step writes in a transaction; list endpoints are paginated
  (cursor by default) with a hard maximum page size; add the index the query needs in the same change.

## Tests (Vitest + supertest unless the repo uses jest)
- Write the failing test first. Unit-test services with a fake repository; test routes through the real app instance with `supertest`
  (no network port). Assert status, body shape and the error envelope, not implementation details.
- Every endpoint test file includes the negative paths: invalid body -> 400 with `error.code`, missing resource -> 404, unauthorised -> 401/403.
- **Unattended runs cannot start Docker.** Use an in-memory or file-based database fixture (or a fake repository) for the autonomous path;
  Testcontainers / real-Postgres integration tests are `MANUAL` or opt-in (`CCS_INTEGRATION=1`) and are reported as unproven.
- Zero assertions is not a passing test. Do not `it.skip` to go green.

## Autonomy: mark these tasks `autonomy: human`
Authentication/authorisation, password or token handling, cryptography, payment flows, schema migrations against a shared database,
infra and CI changes, new third-party dependencies, and any change to a public contract that has external consumers.

See `reference/testing.md` for a supertest + Vitest skeleton.
