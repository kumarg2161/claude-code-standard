# Core Behaviors

- When uncertain about a requirement, ASK before assuming.
- When multiple approaches exist, state trade-offs before picking one.
- When modifying code, read the existing file first. Do not generate from memory.
- When a test fails, read the actual error output before attempting a fix.
- Never create *-v2.ts, *-enhanced.ts, or *-new.ts files. Modify the original.
- Never return empty arrays/objects to "handle" errors. Errors must propagate.
- When I say "is it done?", run the relevant test/build command and report the actual output.
