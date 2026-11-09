---
name: react-native
description: Use when building, reviewing or testing React Native or Expo mobile screens: navigation (expo-router or React Navigation), platform differences, lists, secure storage, offline behaviour, app config and environment variables, jest-expo and React Native Testing Library tests, or opt-in Maestro end-to-end flows.
---

# React Native / Expo conventions

Detect first: Expo (managed vs bare, `app.json`/`app.config.*`), router (expo-router or React Navigation), state/query libraries, test setup (`jest-expo`). **Follow the repo.**

## Rules (constitution Articles M-1..M-4)
- **Expo-first.** Prefer Expo SDK modules over community native modules. Adding or changing a **native module, config plugin or permission is a human task**
  (it changes the binary and needs a rebuild and store review).
- **Secrets and tokens:** never in the JS bundle or `EXPO_PUBLIC_*` variables (they ship to every device). Store tokens in `expo-secure-store`, never `AsyncStorage`.
  Anything that must stay secret lives on the API.
- **Types and API clients come from the contract** (`packages/shared-types`), the same package the web app uses.
- **Platform differences are explicit** (`Platform.select`, `.ios.tsx`/`.android.tsx`), and the screen is checked for safe areas, keyboard avoidance and small screens.
- **Lists:** `FlatList`/`FlashList` with a stable `keyExtractor`, no inline anonymous heavy renderers; never `ScrollView` over unbounded data.
- **Offline and failure are normal.** Every network call has loading, error and retry states; show stale data rather than a blank screen where it is safe.
- Accessibility: `accessibilityRole`, `accessibilityLabel` on icon-only controls, touch targets >= 44pt.

## Tests
- **jest-expo + React Native Testing Library**, with MSW or a mocked API client. Write the failing test first. Query by role/label/text as a user would
  (`getByRole('button', { name: /sign in/i })`), assert navigation and visible state. Include error and empty paths.
- **Device and simulator tests are not available unattended.** Maestro/Detox flows (`pnpm test:e2e`) run only when `CCS_MOBILE_E2E=1` **and** a simulator is
  already booted; otherwise list them as `MANUAL` (unproven). `eas build`, `eas submit` and `expo prebuild` are always denied in runs.
- Zero assertions is not a passing test; do not `it.skip` to go green.

## Autonomy: mark these tasks `autonomy: human`
Anything needing a device or simulator to judge, native modules/config plugins/permissions, app icons, splash and store assets, push-notification setup,
deep-link/universal-link configuration, biometrics, payments, and visual design.
