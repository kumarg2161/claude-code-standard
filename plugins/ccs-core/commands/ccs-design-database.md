---
description: Design a database schema after asking about query patterns, scale and database choice. Interactive only.
---

Design a database schema for: $ARGUMENTS

Before designing, ask about:
1. Expected query patterns
2. Scale (rows, reads/writes per second)
3. Database preference (PostgreSQL, MongoDB, DynamoDB)

Then produce:
1. ERD description
2. CREATE TABLE / collection structure
3. Indexes with justification
4. Migration SQL (up + down)
5. Example queries for common access patterns
