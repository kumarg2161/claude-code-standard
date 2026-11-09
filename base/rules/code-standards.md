# Code Standards

- Every function that can fail must have explicit error handling.
- Every API endpoint must validate input at the boundary.
- Every database query must handle the "not found" case.
- Log at appropriate levels: error for failures, warn for degraded, info for business events.
- Never log sensitive data (passwords, tokens, PII).
- DRY: if a pattern appears 3+ times, extract it.
- Dead code must be removed, not commented out.
