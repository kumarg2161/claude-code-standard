# jest-expo + RNTL skeleton

```tsx
// apps/mobile/src/screens/SignIn.test.tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { SignIn } from './SignIn';

it('shows an error for a failed sign-in and stays on the screen (error path)', async () => {
  const signIn = jest.fn().mockRejectedValue(new Error('bad credentials'));
  render(<SignIn onSubmit={signIn} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), 'a@b.co');
  await user.press(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/bad credentials/i);
});
```
`jest.config`: `preset: 'jest-expo'`. Mock native modules (`expo-secure-store`) in the shared jest setup, not per test.
