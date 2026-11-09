---
name: react-web
description: Use when building, reviewing or testing React web UI (Vite or Next.js): components, hooks, forms, server state with TanStack Query, routing, accessibility, React Testing Library, MSW, or Playwright end-to-end tests.
---

# React web conventions

Detect first: Vite vs Next (`next.config.*`), router, state/query libraries, test runner (vitest or jest), CSS approach. **Follow the repo; do not add a second library for the same job.**

## Structure
Feature folders (`features/<name>/{components,hooks,api,index.ts}`), not type folders. Components are small and mostly pure; data fetching and mutations live in hooks;
shared UI primitives live in one place. No business rules in JSX.

## Rules (constitution Articles W-1..W-3)
- **Server state is not component state.** Use TanStack Query (or the repo's equivalent) for anything from the API; local `useState` only for UI state. No `useEffect` for fetching.
- **Types come from the contract.** Request/response types and zod schemas come from `packages/shared-types` (generated from `contracts/openapi.yaml`); forms validate with the same schema the API uses.
- **Accessible by construction.** Every input has a label, buttons are `<button>`, interactive elements are keyboard reachable with visible focus, images have `alt`, errors are announced (`role="alert"`).
  Tests find elements by **role and name**, which doubles as an accessibility check.
- Handle loading, empty and error states for every async view; an unhandled rejected query must surface an error state, never a blank screen.
- No secrets in client code or `NEXT_PUBLIC_*`/`VITE_*` variables. Never `dangerouslySetInnerHTML` with unsanitised input.

## Tests
- **React Testing Library + vitest/jest, with MSW** to mock the network. Write the failing test first; assert what the user sees and can do
  (`getByRole('button', { name: /save/i })`), not implementation details. Include the error and empty paths.
- **Playwright needs browsers and a dev server**, so it is not part of the autonomous gate by default: expose it as `pnpm test:e2e`, run it when
  `CCS_E2E=1`, otherwise list the scenarios as `MANUAL` (unproven). Never mark a visual or UX acceptance criterion as passed from a unit test.
- Zero assertions is not a passing test; do not `it.skip` to go green.

## Autonomy: mark these tasks `autonomy: human`
Visual design, layout and branding decisions, animation, authentication UI flows that touch tokens, accessibility audits that need a screen reader,
and any new UI library or design-system decision.
