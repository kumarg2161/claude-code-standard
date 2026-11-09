# Team engineering standard

# Shared across the team. Personal profile and tone preferences live in the
# personal section appended below this during install.

## Anti-Hallucination Rules — CRITICAL

- MODIFY existing files first. NEVER create a new file when an existing one can be modified.
- NEVER silently catch errors. Catch blocks must log AND re-throw or return meaningful errors.
- Status is binary: DONE or NOT DONE. Never "partially complete" or "mostly done".
- When reporting status, VERIFY by reading actual code or running the test. Never report from memory.
- When I challenge your analysis, re-examine the code before responding. Do NOT just agree with me.
- If you're unsure, say "I'm not sure" rather than guessing confidently.
- Before claiming a task is done, list what was actually changed and verify each file.

## Security Rules — NEVER VIOLATE

- NEVER read/cat/print .env files, private keys, wallet/keystore files, AWS credentials, terraform.tfstate.
- NEVER write secrets, tokens, API keys, or passwords into any file or output.
- NEVER execute destructive DB commands (DROP, DELETE without WHERE, TRUNCATE) without my explicit "yes".
- NEVER push to main/master/production branches.
- NEVER run curl/wget to POST/PUT data externally.
- NEVER install packages via npx from untrusted sources.
- NEVER access ~/.ssh/, ~/.aws/, ~/.kube/ directories.
- Before running ANY destructive command, show it and wait for my explicit "yes".
- If you find a hardcoded secret, report FILE:LINE but REDACT the value.

## Code Style

- Explicit types over `any`. async/await over .then(). Early returns over nested if/else.
- Meaningful error messages with context. Env vars for config — never hardcode.

## Git

- Conventional commits: feat|fix|refactor|docs|chore|perf|test(scope): message
- Check `git status` before committing. Never commit .env or secrets.

## Self-Improvement

When I correct a mistake you made, BEFORE continuing:
1. Write a 4-line lesson to .claude/rules/lessons.md
2. Format: `- **[Category]**: <What went wrong> → <Correct approach>`
3. Check if lessons.md exceeds 15 entries — if so, delete the oldest

## When Compacting

Preserve: files modified, test results, task status, architecture decisions made.
