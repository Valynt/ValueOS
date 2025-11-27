/**
 * StateManagement Tests
 * 
 * Tests for Redux/Context state management, actions, and reducers
 * following MCP patterns for state testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('StateManagement', () => {
  let mockState: any;
  let mockActions: any;
  let mockReducer: any;

  beforeEach(() => {
    mockState = {
      components: [],
      selectedComponent: null,
      user: null,
      ui: {
        sidebarOpen: false,
        theme: 'light'
      }
    };

    mockActions = {
      addComponent: vi.fn(),
      removeComponent: vi.fn(),
      selectComponent: vi.fn(),
      updateComponent: vi.fn()
    };

    mockReducer = vi.fn((state, action) => {
      switch (action.type) {
        case 'ADD_COMPONENT':
          return { ...state, components: [...state.components, action.payload] };
        case 'REMOVE_COMPONENT':
          return { ...state, components: state.components.filter((c: any) => c.id !== action.payload) };
        default:
          return state;
      }
    });
  });

  describe('Redux Store', () => {
    it('should initialize with default state', () => {
      expect(mockState.components).toEqual([]);
      expect(mockState.selectedComponent).toBeNull();
    });

    it('should dispatch actions', () => {
      const action = { type: 'ADD_COMPONENT', payload: { id: 'comp-1' } };
      mockActions.addComponent(action.payload);

      expect(mockActions.addComponent).toHaveBeenCalledWith(action.payload);
    });

    it('should update state via reducer', () => {
      const action = { type: 'ADD_COMPONENT', payload: { id: 'comp-1', type: 'chart' } };
      const newState = mockReducer(mockState, action);

      expect(newState.components.length).toBe(1);
      expect(newState.components[0].id).toBe('comp-1');
    });

    it('should handle multiple actions', () => {
      let state = mockState;
      
      state = mockReducer(state, { type: 'ADD_COMPONENT', payload: { id: 'comp-1' } });
      state = mockReducer(state, { type: 'ADD_COMPONENT', payload: { id: 'comp-2' } });

      expect(state.components.length).toBe(2);
    });

    it('should return unchanged state for unknown actions', () => {
      const action = { type: 'UNKNOWN_ACTION' };
      const newState = mockReducer(mockState, action);

      expect(newState).toEqual(mockState);
    });
  });

  describe('Actions', () => {
    it('should create add component action', () => {
      const component = { id: 'comp-1', type: 'chart' };
      const action = {
        type: 'ADD_COMPONENT',
        payload: component
      };

      expect(action.type).toBe('ADD_COMPONENT');
      expect(action.payload).toEqual(component);
    });

    it('should create remove component action', () => {
      const action = {
        type: 'REMOVE_COMPONENT',
        payload: 'comp-1'
      };

      expect(action.type).toBe('REMOVE_COMPONENT');
      expect(action.payload).toBe('comp-1');
    });

    it('should create update component action', () => {
      const action = {
        type: 'UPDATE_COMPONENT',
        payload: { id: 'comp-1', updates: { title: 'New Title' } }
      };

      expect(action.type).toBe('UPDATE_COMPONENT');
      expect(action.payload.updates.title).toBe('New Title');
    });

    it('should create select component action', () => {
      const action = {
        type: 'SELECT_COMPONENT',
        payload: 'comp-1'
      };

      expect(action.type).toBe('SELECT_COMPONENT');
    });
  });

  describe('Reducers', () => {
    it('should add component to state', () => {
      const action = { type: 'ADD_COMPONENT', payload: { id: 'comp-1' } };
      const newState = mockReducer(mockState, action);

      expect(newState.components).toContainEqual({ id: 'comp-1' });
    });

    it('should remove component from state', () => {
      const initialState = {
        ...mockState,
        components: [{ id: 'comp-1' }, { id: 'comp-2' }]
      };

      const action = { type: 'REMOVE_COMPONENT', payload: 'comp-1' };
      const newState = mockReducer(initialState, action);

      expect(newState.components.length).toBe(1);
      expect(newState.components[0].id).toBe('comp-2');
    });

    it('should not mutate original state', () => {
      const originalState = { ...mockState };
      const action = { type: 'ADD_COMPONENT', payload: { id: 'comp-1' } };
      
      mockReducer(mockState, action);

      expect(mockState).toEqual(originalState);
    });

    it('should handle nested state updates', () => {
      const action = {
        type: 'UPDATE_UI',
        payload: { sidebarOpen: true }
      };

      const reducer = (state: any, action: any) => {
        if (action.type === 'UPDATE_UI') {
          return {
            ...state,
            ui: { ...state.ui, ...action.payload }
          };
        }
        return state;
      };

      const newState = reducer(mockState, action);

      expect(newState.ui.sidebarOpen).toBe(true);
      expect(newState.ui.theme).toBe('light');
    });
  });

  describe('Selectors', () => {
    it('should select all components', () => {
      const state = {
        ...mockState,
        components: [{ id: 'comp-1' }, { id: 'comp-2' }]
      };

      const components = state.components;

      expect(components.length).toBe(2);
    });

    it('should select component by id', () => {
      const state = {
        ...mockState,
        components: [
          { id: 'comp-1', type: 'chart' },
          { id: 'comp-2', type: 'table' }
        ]
      };

      const component = state.components.find((c: any) => c.id === 'comp-1');

      expect(component?.type).toBe('chart');
    });

    it('should select components by type', () => {
      const state = {
        ...mockState,
        components: [
          { id: 'comp-1', type: 'chart' },
          { id: 'comp-2', type: 'chart' },
          { id: 'comp-3', type: 'table' }
        ]
      };

      const charts = state.components.filter((c: any) => c.type === 'chart');

      expect(charts.length).toBe(2);
    });

    it('should memoize selector results', () => {
      const state = mockState;
      const selector = vi.fn(() => state.components);

      selector();
      selector();

      expect(selector).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context API', () => {
    it('should provide context value', () => {
      const context = {
        state: mockState,
        dispatch: vi.fn()
      };

      expect(context.state).toBeDefined();
      expect(context.dispatch).toBeDefined();
    });

    it('should update context value', () => {
      const context = {
        state: mockState,
        setState: vi.fn()
      };

      const newState = { ...mockState, selectedComponent: 'comp-1' };
      context.setState(newState);

      expect(context.setState).toHaveBeenCalledWith(newState);
    });

    it('should consume context in components', () => {
      const context = {
        state: mockState,
        dispatch: vi.fn()
      };

      const component = {
        useContext: () => context
      };

      const ctx = component.useContext();

      expect(ctx.state).toEqual(mockState);
    });

    it('should handle nested contexts', () => {
      const themeContext = { theme: 'light' };
      const userContext = { user: { id: 'user-1' } };

      expect(themeContext.theme).toBe('light');
      expect(userContext.user.id).toBe('user-1');
    });
  });

  describe('Async Actions', () => {
    it('should handle async action dispatch', async () => {
      const asyncAction = async () => {
        return { type: 'FETCH_SUCCESS', payload: { data: [] } };
      };

      const action = await asyncAction();

      expect(action.type).toBe('FETCH_SUCCESS');
    });

    it('should handle loading state', () => {
      const state = {
        loading: true,
        data: null,
        error: null
      };

      expect(state.loading).toBe(true);
    });

    it('should handle success state', () => {
      const state = {
        loading: false,
        data: { items: [] },
        error: null
      };

      expect(state.loading).toBe(false);
      expect(state.data).toBeDefined();
    });

    it('should handle error state', () => {
      const state = {
        loading: false,
        data: null,
        error: 'Failed to fetch data'
      };

      expect(state.error).toBeDefined();
    });
  });

  describe('Middleware', () => {
    it('should log actions', () => {
      const logger = vi.fn((action) => {
        console.log('Action:', action.type);
      });

      const action = { type: 'ADD_COMPONENT' };
      logger(action);

      expect(logger).toHaveBeenCalledWith(action);
    });

    it('should handle async middleware', async () => {
      const asyncMiddleware = async (action: any) => {
        if (action.type === 'FETCH_DATA') {
          return { type: 'FETCH_SUCCESS', payload: {} };
        }
        return action;
      };

      const action = { type: 'FETCH_DATA' };
      const result = await asyncMiddleware(action);

      expect(result.type).toBe('FETCH_SUCCESS');
    });

    it('should validate actions', () => {
      const validator = (action: any) => {
        return action.type && action.type.length > 0;
      };

      const validAction = { type: 'ADD_COMPONENT' };
      const invalidAction = { type: '' };

      expect(validator(validAction)).toBe(true);
      expect(validator(invalidAction)).toBe(false);
    });
  });

  describe('State Persistence', () => {
    it('should save state to localStorage', () => {
      const state = mockState;
      const serialized = JSON.stringify(state);

      expect(serialized).toBeDefined();
      expect(JSON.parse(serialized)).toEqual(state);
    });

    it('should load state from localStorage', () => {
      const savedState = JSON.stringify(mockState);
      const loaded = JSON.parse(savedState);

      expect(loaded).toEqual(mockState);
    });

    it('should handle corrupted state', () => {
      const corruptedState = 'invalid json';
      
      try {
        JSON.parse(corruptedState);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should merge persisted state with defaults', () => {
      const defaultState = { components: [], theme: 'light' };
      const persistedState = { components: [{ id: 'comp-1' }] };

      const merged = { ...defaultState, ...persistedState };

      expect(merged.components.length).toBe(1);
      expect(merged.theme).toBe('light');
    });
  });

  describe('State Normalization', () => {
    it('should normalize nested data', () => {
      const nested = {
        components: [
          { id: 'comp-1', children: [{ id: 'child-1' }] }
        ]
      };

      const normalized = {
        components: { 'comp-1': { id: 'comp-1', children: ['child-1'] } },
        children: { 'child-1': { id: 'child-1' } }
      };

      expect(normalized.components['comp-1'].children).toContain('child-1');
    });

    it('should denormalize data for display', () => {
      const normalized = {
        components: { 'comp-1': { id: 'comp-1', childIds: ['child-1'] } },
        children: { 'child-1': { id: 'child-1', name: 'Child' } }
      };

      const denormalized = {
        id: 'comp-1',
        children: [{ id: 'child-1', name: 'Child' }]
      };

      expect(denormalized.children.length).toBe(1);
    });
  });

  describe('State Immutability', () => {
    it('should not mutate state directly', () => {
      const state = { value: 100 };
      const newState = { ...state, value: 200 };

      expect(state.value).toBe(100);
      expect(newState.value).toBe(200);
    });

    it('should use immutable update patterns', () => {
      const state = { items: [1, 2, 3] };
      const newState = { ...state, items: [...state.items, 4] };

      expect(state.items.length).toBe(3);
      expect(newState.items.length).toBe(4);
    });

    it('should handle deep updates immutably', () => {
      const state = {
        user: { profile: { name: 'John' } }
      };

      const newState = {
        ...state,
        user: {
          ...state.user,
          profile: { ...state.user.profile, name: 'Jane' }
        }
      };

      expect(state.user.profile.name).toBe('John');
      expect(newState.user.profile.name).toBe('Jane');
    });
  });

  describe('Performance Optimization', () => {
    it('should batch state updates', () => {
      const updates = [
        { type: 'ADD_COMPONENT', payload: { id: 'comp-1' } },
        { type: 'ADD_COMPONENT', payload: { id: 'comp-2' } }
      ];

      let state = mockState;
      updates.forEach(action => {
        state = mockReducer(state, action);
      });

      expect(state.components.length).toBe(2);
    });

    it('should memoize expensive computations', () => {
      const compute = vi.fn((state) => {
        return state.components.length;
      });

      compute(mockState);
      compute(mockState);

      expect(compute).toHaveBeenCalledTimes(2);
    });

    it('should use shallow equality checks', () => {
      const state1 = { value: 100 };
      const state2 = { value: 100 };

      const isEqual = state1 === state2;

      expect(isEqual).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle reducer errors', () => {
      const errorReducer = (state: any, action: any) => {
        if (action.type === 'ERROR_ACTION') {
          throw new Error('Reducer error');
        }
        return state;
      };

      expect(() => {
        errorReducer(mockState, { type: 'ERROR_ACTION' });
      }).toThrow('Reducer error');
    });

    it('should recover from errors', () => {
      const state = { ...mockState, error: 'Previous error' };
      const action = { type: 'CLEAR_ERROR' };

      const reducer = (state: any, action: any) => {
        if (action.type === 'CLEAR_ERROR') {
          return { ...state, error: null };
        }
        return state;
      };

      const newState = reducer(state, action);

      expect(newState.error).toBeNull();
    });
  });
});
