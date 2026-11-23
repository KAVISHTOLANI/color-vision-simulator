import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('Color Lens', () => {
  it('flags red/green clashes in the demo palette', () => {
    window.location.hash = '/palette';
    render(<App />);
    expect(screen.getByTestId('flagged')).toHaveTextContent(/pairs? become hard to tell apart/);
    const pairs = screen.getByRole('table', { name: /Colour difference/ });
    expect(within(pairs).getByRole('rowheader', { name: /#d62728 \/ #2ca02c/ })).toHaveTextContent('Clash');
  });

  it('validates and adds colours, and removes them', async () => {
    window.location.hash = '/palette';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Add at least two colours')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add colours'), '#1f77b4 nope');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Not a hex colour: nope')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Add colours'));
    await user.type(screen.getByLabelText('Add colours'), '#1f77b4, #ff7f0e');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByTestId('flagged')).toHaveTextContent('No pairs collapse');
    await user.click(screen.getByRole('button', { name: 'Remove #ff7f0e' }));
    expect(screen.getByText('Add at least two colours')).toBeInTheDocument();
  });

  it('shows the image controls and degrades without canvas', async () => {
    window.location.hash = '/image';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByLabelText('Image')).toHaveValue('chart');
    await user.click(screen.getByRole('radio', { name: 'One type, adjustable' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'protan');
    expect(screen.getByRole('img', { name: 'Simulated Protanopia (red-blind) at 100%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
  });

  it('rejects unsupported uploads', async () => {
    window.location.hash = '/image';
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await user.upload(screen.getByLabelText('Upload image'), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getByText(/Choose a PNG, JPEG/)).toBeInTheDocument();
  });
});
