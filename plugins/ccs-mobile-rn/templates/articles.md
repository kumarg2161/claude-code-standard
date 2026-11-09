<!-- ccs-mobile-rn -->
## Article M-1 — Expo-first; native changes are human decisions
Prefer Expo SDK modules. Native modules, config plugins and permission changes need a person.

## Article M-2 — Nothing secret ships in the bundle
No secrets in JS or `EXPO_PUBLIC_*`. Tokens live in secure storage, never AsyncStorage.

## Article M-3 — Contract-derived clients; explicit platform handling
API types and clients come from the shared contract package; platform differences and safe areas are handled explicitly.

## Article M-4 — Unattended-safe tests
The autonomous gate runs jest-expo + RNTL only. Simulator/device E2E is opt-in (`CCS_MOBILE_E2E=1` with a booted simulator) and otherwise MANUAL.
<!-- /ccs-mobile-rn -->
