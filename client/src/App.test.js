import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios');

test('signed-out visitors see the landing page with Google sign-in', async () => {
  localStorage.removeItem('token');
  render(<App />);
  expect((await screen.findAllByRole('button', { name: 'Sign In with Google' })).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Roadmap' })).not.toBeInTheDocument();
});
