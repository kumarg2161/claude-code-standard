---
description: Security-focused review of the current changes or a given path.
---

Run a security-focused review on $ARGUMENTS (or current changes if no argument).

Check for:
1. OWASP Top 10 vulnerabilities
2. Hardcoded secrets, API keys, tokens (report file:line, REDACT the value)
3. SQL/NoSQL injection risks
4. Missing input validation at API boundaries
5. Insecure cryptographic practices
6. Missing rate limiting on sensitive endpoints
7. Error messages that leak internal details
8. Missing authentication/authorization checks
9. Insecure direct object references
10. Missing CORS/CSP headers

Report format: SEVERITY | File:Line | Issue | Remediation
