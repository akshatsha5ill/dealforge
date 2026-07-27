import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ConfirmDialogContainer, { confirm } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no confirm is active', () => {
    render(<ConfirmDialogContainer />);
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('shows dialog when confirm() is called', async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      confirm('Are you sure?', 'This action cannot be undone.');
    });

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('resolves true when confirm button is clicked', async () => {
    render(<ConfirmDialogContainer />);

    let result: boolean | null = null;
    act(() => {
      confirm('Delete item?', 'This will permanently delete it.').then((r) => { result = r; });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    expect(result).toBe(true);
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument();
  });

  it('resolves false when cancel button is clicked', async () => {
    render(<ConfirmDialogContainer />);

    let result: boolean | null = null;
    act(() => {
      confirm('Are you sure?', 'Please confirm.').then((r) => { result = r; });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    expect(result).toBe(false);
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('shows custom confirm label', async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      confirm('Remove member?', 'They will lose access.', { confirmLabel: 'Remove' });
    });

    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('shows default Delete label when no custom label provided', async () => {
    render(<ConfirmDialogContainer />);

    act(() => {
      confirm('Confirm action?', 'Are you sure?');
    });

    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
