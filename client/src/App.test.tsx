import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders the team name and foundation status', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: '24 Hour Party People' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Project foundation ready')).toBeInTheDocument();
  });
});
