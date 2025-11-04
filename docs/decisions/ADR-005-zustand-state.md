# ADR-005: Zustand for State Management

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** state-management, zustand, react, frontend

## Context

Kirana frontend needs to manage:
- **Global state**: User authentication, item list, filter/sort settings
- **Derived state**: Filtered/sorted items, urgency counts (critical/warning/normal)
- **API cache**: Avoid redundant API calls for unchanged data
- **Optimistic updates**: Mark item as restocked before API confirms
- **Real-time updates**: Poll for prediction changes every 5 minutes

We evaluated five state management solutions:
1. **React Context + useReducer**: Built-in, no dependencies
2. **Redux Toolkit**: Industry standard, powerful DevTools
3. **Zustand**: Lightweight (<1KB), hooks-based
4. **Jotai**: Atomic state management, similar to Recoil
5. **MobX**: Observable-based, automatic reactivity

## Decision

We will use **Zustand 4.5** for global state management.

### Store Architecture

**1. Item Store** (`stores/itemStore.ts`):
```typescript
interface ItemStore {
  // State
  items: Item[];
  filter: 'running_out' | 'low_confidence' | 'all';
  sortBy: 'urgency' | 'name' | 'date';
  loading: boolean;
  error: string | null;
  
  // Computed (getters)
  filteredItems: () => Item[];
  criticalCount: () => number;
  warningCount: () => number;
  
  // Actions
  fetchItems: () => Promise<void>;
  setFilter: (filter: string) => void;
  setSortBy: (sortBy: string) => void;
  restockItem: (itemId: string, date: Date) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

const useItemStore = create<ItemStore>((set, get) => ({
  items: [],
  filter: 'running_out',
  sortBy: 'urgency',
  loading: false,
  error: null,
  
  filteredItems: () => {
    const { items, filter } = get();
    if (filter === 'running_out') return items.filter(i => i.daysUntilRunOut <= 7);
    if (filter === 'low_confidence') return items.filter(i => i.predictionConfidence === 'low');
    return items;
  },
  
  criticalCount: () => get().items.filter(i => i.urgency === 'critical').length,
  warningCount: () => get().items.filter(i => i.urgency === 'warning').length,
  
  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/items');
      set({ items: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  restockItem: async (itemId, date) => {
    // Optimistic update
    set(state => ({
      items: state.items.map(item =>
        item.id === itemId ? { ...item, lastRestocked: date } : item
      )
    }));
    
    try {
      await apiClient.post(`/items/${itemId}/restock`, { date });
    } catch (error) {
      // Revert on error
      await get().fetchItems();
      throw error;
    }
  }
}));
```

**2. Auth Store** (`stores/authStore.ts`):
```typescript
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const useAuthStore = create<AuthStore>(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: async (email, password) => {
        const { token, user } = await apiClient.post('/auth/login', { email, password });
        set({ token, user, isAuthenticated: true });
      },
      
      logout: () => set({ user: null, token: null, isAuthenticated: false })
    }),
    { name: 'auth-storage' } // Persist to localStorage
  )
);
```

**3. Budget Store** (`stores/budgetStore.ts`):
```typescript
interface BudgetStore {
  dailyCap: number;
  currentSpend: number;
  remaining: number;
  utilizationPercent: number;
  enforcementActive: boolean;
  
  fetchBudgetStatus: () => Promise<void>;
}

const useBudgetStore = create<BudgetStore>((set) => ({
  dailyCap: 50,
  currentSpend: 0,
  remaining: 50,
  utilizationPercent: 0,
  enforcementActive: true,
  
  fetchBudgetStatus: async () => {
    const data = await apiClient.get('/budget/status');
    set(data);
  }
}));
```

### Usage in Components

```typescript
// Dashboard.tsx
function Dashboard() {
  const { items, filter, setFilter, fetchItems, criticalCount } = useItemStore();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
    }
  }, [isAuthenticated]);
  
  return (
    <div>
      <h2>Critical Items: {criticalCount()}</h2>
      <FilterBar value={filter} onChange={setFilter} />
      <ItemList items={items} />
    </div>
  );
}
```

### Selector Pattern (Performance)

```typescript
// Only re-render when criticalCount changes (not on every item update)
const criticalCount = useItemStore(state => 
  state.items.filter(i => i.urgency === 'critical').length
);

// Even better: use computed selector from store
const criticalCount = useItemStore(state => state.criticalCount());
```

## Consequences

### Positive

✅ **Tiny bundle size**: 1.2KB gzipped (vs Redux 15KB, MobX 18KB)  
✅ **Simple API**: No boilerplate (vs Redux actions/reducers)  
✅ **TypeScript native**: Full type inference without extra config  
✅ **React hooks based**: Feels natural with React 18  
✅ **No Provider wrapper**: Use stores directly without context hell  
✅ **Computed values**: Getters for derived state (filteredItems, counts)  
✅ **Middleware support**: Persist, devtools, immer available  
✅ **Performance**: Automatic selector optimization (no useMemo needed)  

### Negative

❌ **No time-travel debugging**: DevTools less powerful than Redux DevTools  
❌ **Manual optimization**: Need to write selectors carefully to avoid re-renders  
❌ **Less opinionated**: No enforced patterns (team must agree on conventions)  
❌ **Smaller ecosystem**: Fewer plugins/middleware than Redux  
❌ **Learning curve**: Different mental model from Redux (stores not reducers)  

### Alternatives Considered

**React Context + useReducer**:
- ❌ Rejected: Context causes re-renders of all consumers (not just changed values)
- ❌ Provider hell with multiple contexts (auth, items, budget)
- ✅ No dependencies (built-in)
- ❌ No DevTools integration
- ❌ Verbose action creators and reducers

**Redux Toolkit**:
- ❌ Rejected: Too heavy for simple app (15KB + react-redux 5KB)
- ✅ Powerful DevTools (time-travel debugging)
- ✅ Industry standard (easy to hire devs)
- ❌ Boilerplate even with Toolkit (actions, reducers, slices)
- ❌ Learning curve for new devs

**Jotai**:
- ❌ Rejected: Atomic state harder to reason about for team
- ✅ Very lightweight (3KB)
- ✅ Flexible (bottom-up composition)
- ❌ Requires atoms everywhere (vs single store)
- ❌ Less mature than Zustand (fewer resources)

**MobX**:
- ❌ Rejected: Observable-based model unfamiliar to team
- ✅ Automatic reactivity (no manual re-rendering)
- ❌ Heavier bundle (18KB)
- ❌ Class-based stores (vs functional)
- ❌ Decorators require babel plugin

**Recoil**:
- ❌ Rejected: Meta-owned (uncertain future, still experimental)
- ✅ Atomic state like Jotai
- ❌ Requires RecoilRoot provider
- ❌ Heavier than Zustand (9KB)
- ❌ Less TypeScript-friendly

## Implementation Notes

### Best Practices

1. **Single Responsibility**: One store per domain (items, auth, budget)
2. **Selectors**: Use selectors to prevent unnecessary re-renders
3. **Async Actions**: Handle loading/error states in actions
4. **Optimistic Updates**: Update UI immediately, revert on error
5. **Persistence**: Use `persist` middleware for auth token

### DevTools Integration

```typescript
import { devtools } from 'zustand/middleware';

const useItemStore = create<ItemStore>(
  devtools(
    (set, get) => ({
      // ... store implementation
    }),
    { name: 'ItemStore' }
  )
);
```

### Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useItemStore } from './itemStore';

test('fetchItems updates state', async () => {
  const { result } = renderHook(() => useItemStore());
  
  await act(async () => {
    await result.current.fetchItems();
  });
  
  expect(result.current.items.length).toBeGreaterThan(0);
  expect(result.current.loading).toBe(false);
});
```

### Performance Tips

- ✅ Use shallow equality for objects: `useItemStore(state => state.items, shallow)`
- ✅ Split large stores into smaller ones (don't put everything in one store)
- ✅ Use computed values (getters) for derived state
- ❌ Avoid storing derived state (compute on read)
- ❌ Don't put UI state in Zustand (use local useState for modals, tooltips)

## Migration Strategy

If Zustand becomes insufficient:
1. **Phase 1**: Add Redux DevTools middleware to Zustand (keeps same API)
2. **Phase 2**: Migrate to Jotai if atomic state needed (similar hooks API)
3. **Phase 3**: Consider Redux Toolkit for complex workflows (last resort)

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand vs Redux Comparison](https://github.com/pmndrs/zustand/wiki/Comparison)
- [React State Management in 2024](https://leerob.io/blog/react-state-management)
- PRD Section 7.2: "State Management"
- Tech Spec Section 4.3: "Frontend Data Flow"

## Review History

- 2025-11-03: Initial version (Accepted)
