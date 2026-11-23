import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios');

test('signed-out visitors see the landing page with Google sign-in', async () => {
  localStorage.removeItem('token');
  render(<App />);
  // Top bar (secondary) and hero (primary).
  expect(await screen.findAllByRole('button', { name: 'Continue with Google' })).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /Analyze My Resume/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Roadmap' })).not.toBeInTheDocument();
});
