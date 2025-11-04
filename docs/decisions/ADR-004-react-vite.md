# ADR-004: React + Vite for Frontend

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** frontend, react, vite, spa

## Context

Kirana frontend needs to provide:
- **Real-time updates**: Dashboard reflects urgency changes without page refresh
- **Fast load times**: <2s initial load on 3G connection
- **Responsive UI**: Works on mobile (iOS Safari) and desktop (Chrome/Edge)
- **Developer experience**: Fast hot module reload (HMR), TypeScript support
- **SEO**: Not critical (authenticated app, no public landing page)

We evaluated four frontend approaches:
1. **React + Vite**: Modern SPA with fast dev server and build
2. **Next.js**: React framework with SSR and file-based routing
3. **Vue 3 + Vite**: Alternative framework with Composition API
4. **Vanilla JS + Web Components**: Framework-free approach

## Decision

We will use **React 18 + Vite** for the frontend SPA.

### Technology Stack

- **Framework**: React 18.3 (latest stable)
- **Build Tool**: Vite 5.4 (ESM-based, fast HMR)
- **Language**: TypeScript 5.5 (strict mode)
- **State Management**: Zustand 4.5 (lightweight, ~1KB)
- **Routing**: React Router 6.26 (SPA routing)
- **Styling**: CSS Modules + Tailwind CSS (utility-first)
- **API Client**: Fetch API with custom wrapper (no axios)
- **Icons**: Lucide React (tree-shakeable, <5KB)

### Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ItemCard.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   └── EmptyState.tsx
│   ├── pages/             # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── TeachMode.tsx
│   │   └── Import.tsx
│   ├── stores/            # Zustand stores
│   │   ├── itemStore.ts
│   │   └── authStore.ts
│   ├── services/          # API clients
│   │   └── apiClient.ts
│   ├── utils/             # Helper functions
│   │   ├── accessibility.ts
│   │   └── dateUtils.ts
│   ├── App.tsx            # Root component
│   └── main.tsx           # Entry point
├── index.html
├── vite.config.ts
└── tsconfig.json
```

### Vite Configuration Highlights

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:7071' // Proxy to Azure Functions local
    }
  }
});
```

## Consequences

### Positive

✅ **Fast development**: Vite HMR <100ms (vs Webpack ~2s)  
✅ **Instant server start**: Cold start <500ms (Vite ESM vs Webpack bundling)  
✅ **TypeScript native**: No babel-loader, direct esbuild transpilation  
✅ **Tree-shaking**: Only used code included (React bundle ~45KB gzipped)  
✅ **React ecosystem**: Massive library ecosystem (react-router, zustand, lucide)  
✅ **Component reusability**: Easy to extract and test components in Storybook  
✅ **Optimized builds**: Rollup production builds with code splitting  

### Negative

❌ **No SSR**: Can't pre-render for SEO (acceptable - authenticated app)  
❌ **Client-side routing**: Initial load includes router code (+10KB)  
❌ **Build complexity**: Need to understand Vite + Rollup configs  
❌ **Bundle size**: React + React-DOM + Router = ~50KB (vs Vue ~35KB)  
❌ **No built-in API routes**: Need separate backend (Azure Functions)  

### Alternatives Considered

**Next.js 14**:
- ❌ Rejected: Overkill for authenticated SPA (SSR/SSG not needed)
- ❌ File-based routing adds complexity for simple app (5 routes)
- ❌ Heavier bundle (Next.js runtime + React)
- ✅ Better for SEO and multi-page apps (not Kirana's case)
- ❌ Azure deployment more complex (need Node.js server)

**Vue 3 + Vite**:
- ❌ Rejected: Team more familiar with React (faster development)
- ✅ Slightly smaller bundle size (~35KB vs ~50KB)
- ✅ Composition API similar to React hooks
- ❌ Smaller ecosystem than React (fewer libraries)
- ❌ Less community knowledge (harder to find solutions)

**Vanilla JS + Web Components**:
- ❌ Rejected: Too low-level for complex state management
- ❌ No built-in reactivity (need manual DOM updates)
- ✅ Zero framework overhead (smallest bundle)
- ❌ Reinventing the wheel for routing, state, etc.
- ❌ Slower development velocity

**Angular 18**:
- ❌ Rejected: Too heavy for simple SPA (full framework)
- ❌ Steeper learning curve (RxJS, dependency injection)
- ❌ Larger bundle size (~100KB+ base)
- ✅ TypeScript native (like our stack)
- ❌ Overkill for 5-page app

## Implementation Notes

### Performance Optimizations

1. **Code Splitting**: Route-based lazy loading with React.lazy()
   ```typescript
   const Dashboard = React.lazy(() => import('./pages/Dashboard'));
   ```

2. **Asset Optimization**: Vite automatically optimizes images, fonts, CSS

3. **API Caching**: Zustand store caches API responses (5-minute TTL)

4. **Virtual Scrolling**: For large lists (100+ items) use react-window

5. **Prefetching**: Preload critical routes on hover

### Developer Experience

- **Hot Module Reload**: Changes reflect in <100ms without full refresh
- **TypeScript**: Catch errors at compile time, better autocomplete
- **ESLint + Prettier**: Code quality and formatting enforced
- **Vite DevTools**: React DevTools + Network tab for debugging

### Build Performance

- **Dev server start**: <500ms (Vite ESM)
- **HMR update**: <100ms (single module replace)
- **Production build**: ~10s for full app (Rollup + esbuild)
- **Bundle size**: ~120KB total (50KB React + 70KB app code, gzipped)

## Migration Strategy

If React becomes too heavy or we need SSR:
1. **Phase 1**: Consider Preact (React-compatible, 3KB vs 45KB)
2. **Phase 2**: Add SSR with Vite SSR plugin (not Next.js)
3. **Phase 3**: Evaluate Astro for static pages + React islands

## References

- [Vite Documentation](https://vitejs.dev/)
- [React 18 Documentation](https://react.dev/)
- [Why Vite (vs Webpack/CRA)](https://vitejs.dev/guide/why.html)
- [Vite React Plugin](https://github.com/vitejs/vite-plugin-react)
- PRD Section 7: "Frontend Architecture"
- Tech Spec Section 4.1: "React Component Hierarchy"

## Review History

- 2025-11-03: Initial version (Accepted)
