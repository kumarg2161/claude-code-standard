# Vitest + supertest skeleton

```ts
// apps/api/test/users.routes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';          // factory: no listen(), accepts fakes
import { FakeUserRepo } from './fakes/user-repo';

describe('POST /users', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { app = buildApp({ users: new FakeUserRepo() }); });

  it('creates a user (201) and returns the contract shape', async () => {
    const res = await request(app.server).post('/users').send({ email: 'a@b.co', name: 'Ada' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), email: 'a@b.co' });
  });

  it('rejects an invalid body with the error envelope (400)', async () => {
    const res = await request(app.server).post('/users').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('still serves /health (negative: unrelated route unaffected)', async () => {
    expect((await request(app.server).get('/health')).status).toBe(200);
  });
});
```
Keep `buildApp(deps)` free of side effects so tests construct it directly. Adapt `app.server` to the framework (`app` for Express, `app.server` after `await app.ready()` for Fastify).
