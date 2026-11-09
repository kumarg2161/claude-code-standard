<!-- ccs-backend-ts -->
## Article B-1 — Validate at the boundary
Every request (body, query, params, headers) is parsed by a schema before use; handler types derive from the schema.

## Article B-2 — One error envelope
Errors are `{ "error": { "code", "message", "details" } }`, produced in one handler from typed errors thrown by services. No swallowed errors.

## Article B-3 — Contract first, layered modules
Endpoints are specified in `contracts/openapi.yaml` before implementation. Handlers hold no business logic; services hold no HTTP types; only repositories touch the database.

## Article B-4 — Unattended-safe tests
The autonomous path must not need Docker, network or a real database. Real-database integration tests are opt-in and reported as unproven.
<!-- /ccs-backend-ts -->
