Perform a comprehensive code review of the current changes (git diff).

Review criteria:
1. **Correctness**: Logic errors, edge cases, off-by-one errors
2. **Error handling**: Missing try/catch, swallowed errors, unhelpful error messages
3. **Type safety**: Any `any` types, missing null checks, unsafe casts
4. **Security**: Input validation, SQL injection, XSS, hardcoded secrets
5. **Performance**: N+1 queries, unnecessary re-renders, missing indexes
6. **Naming**: Unclear variable/function names, misleading names
7. **DRY**: Duplicated logic that should be extracted

For each finding, provide:
- File:line reference
- Severity (CRITICAL / HIGH / MEDIUM / LOW)
- One-line description
- Suggested fix (code snippet if applicable)

Do NOT summarize what the code does. Only report actionable findings.
