# RTL + MSW skeleton

```tsx
// apps/web/src/features/signup/SignupForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';          // msw setupServer, started in vitest setup
import { SignupForm } from './SignupForm';

it('shows the server error without losing the form values (error path)', async () => {
  server.use(http.post('/users', () => HttpResponse.json({ error: { code: 'EMAIL_TAKEN', message: 'Taken' } }, { status: 409 })));
  render(<SignupForm />);
  await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.co');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/taken/i);
  expect(screen.getByRole('textbox', { name: /email/i })).toHaveValue('a@b.co');
});
```
Wrap components in the app's providers through one `renderWithProviders` helper rather than repeating setup per test.
