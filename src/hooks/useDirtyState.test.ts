import { act, renderHook } from '@testing-library/react';
import { useDirtyState, useBeforeUnload } from './useDirtyState';

describe('useDirtyState', () => {
  const initialState = { name: 'Alice', age: 30 };

  it('tracks dirty state when values change', () => {
    const onDirtyChange = vi.fn();
    const { result } = renderHook(() => useDirtyState(initialState, onDirtyChange));

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateState({ age: 31 });
    });

    expect(result.current.isDirty).toBe(true);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('resets to original state and saves changes', () => {
    const { result } = renderHook(() => useDirtyState(initialState));

    act(() => {
      result.current.updateState({ name: 'Bob' });
    });

    expect(result.current.state.name).toBe('Bob');
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.saveState();
    });

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateState({ name: 'Charlie' });
      result.current.resetState();
    });

    expect(result.current.state.name).toBe('Bob');
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useBeforeUnload', () => {
  it('registers beforeunload handler when dirty', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');

    const message = 'Unsaved changes';
    const { unmount } = renderHook(() => useBeforeUnload(true, message));

    expect(addListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', {
      writable: true,
      value: undefined,
    });

    const handler = addListener.mock.calls.find(([name]) => name === 'beforeunload')?.[1] as
      | ((ev: BeforeUnloadEvent) => void)
      | undefined;

    handler?.(event);
    expect(event.returnValue).toBe(message);

    unmount();
    expect(removeListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
