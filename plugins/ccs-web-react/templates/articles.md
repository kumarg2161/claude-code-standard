<!-- ccs-web-react -->
## Article W-1 — Server state is not component state
API data goes through the query layer; components hold only UI state. Types and form schemas come from the shared contract package.

## Article W-2 — Accessible by construction
Labelled inputs, semantic elements, keyboard operability, announced errors. Tests locate elements by role and accessible name.

## Article W-3 — Every async view has loading, empty and error states
Tests cover the error and empty paths, not only the happy path.

## Article W-4 — Unattended-safe tests
The autonomous gate must not need a browser, a dev server or the network (use MSW). Playwright runs only when `CCS_E2E=1`; visual acceptance is MANUAL.
<!-- /ccs-web-react -->
