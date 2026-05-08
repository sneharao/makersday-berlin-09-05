# React & React Router Patterns

How to write components, hooks, and route handlers. For component file structure, placement, and import boundary rules, see `repo-architecture/frontend/component-conventions.md`.

## Component Library Hierarchy

1. **Base UI** (preferred) — headless components with excellent accessibility
2. **Custom components** — built on top of Base UI primitives

NOTE: The codebase currently uses both Base UI and Radix UI. Prefer Base UI for new components. See `harness/housekeeping/debt.md` for the migration plan.

## Component Structure

All React components follow this pattern:

```typescript
export interface LibraryCardProps {
  /** The library to display */
  library: Library;
  /** Callback when the user opens the library */
  onOpen?: (libraryId: string) => void;
  /** Whether the card is in loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Component variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function LibraryCard({
  library,
  onOpen,
  isLoading = false,
  className,
  variant = 'primary',
  size = 'md',
}: LibraryCardProps): JSX.Element {
  // ...
}
```

### Component Rules

- **Functional components only** — no class components
- **JSDoc on every prop** — describe what it does
- **Default values** for optional props
- **`JSX.Element` return type** — explicit return type on all components
- **Loading and error states** — every component with async data must handle both
- **`className` prop** — accept and merge with internal classes using `cn()`

### Component SRP

A component should represent one visual concept or one behavioural concern. If a component has business logic AND layout AND data fetching, it has three reasons to change. Split into a data-fetching wrapper, a presentational component, and a hook for business logic.

### Decompose Conditional Rendering

Complex ternary chains or nested conditionals in JSX should be extracted into named sub-components or helper functions with descriptive names.

```typescript
// Good — named sub-component communicates intent
<EmptyLibraryState />

// Avoid — inline conditional hides intent
{libraries.length === 0 && <div className="p-m text-text-subtle">No libraries yet</div>}
```

## Composition Over Prop Drilling

Deep prop chains are the React equivalent of Law of Demeter violations. Use composition (`children`), compound components, context, or custom hooks to break the chain.

```typescript
<Card>
  <CardHeader>
    <h2>Library</h2>
  </CardHeader>
  <CardContent>
    <ArtifactList artifacts={artifacts} />
  </CardContent>
</Card>
```

## State Management

### Lift State Thoughtfully

State should live at the lowest common ancestor that needs it. Lifting state too high couples unrelated subtrees and triggers unnecessary re-renders.

### Encapsulate Complex State Logic

When `useState` + multiple `useEffect` handlers become tangled, extract into a custom hook with a clear name and interface. The hook is the "class" equivalent in functional React — it encapsulates related state and behaviour behind a clean API.

## Custom Hooks

```typescript
export interface UseChatsReturn {
  chats: Chat[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useChats(userId: string): UseChatsReturn {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ... implementation

  return { chats, isLoading, error, refetch: fetchChats };
}
```

### Hook Rules
- Always return a typed interface
- Include loading, error, and data states
- Provide refetch/retry functionality
- Use proper dependency arrays in `useEffect`
- Handle cleanup for subscriptions or timers

For where a hook should live (the five-tier placement decision), see [repo-architecture/frontend/hooks.md](../../repo-architecture/frontend/hooks.md).

## React Router Route Patterns

### Loader (Server-Side Data Fetching)

```typescript
export async function loader({ params, context }: LoaderFunctionArgs) {
  const libraryId = requireParam(params, 'libraryId', '/');
  const ctx = context.get(sessionContext);
  const library = await libraryController.getById(ctx.user.id, libraryId);
  return { library };
}

export default function LibraryDetailPage() {
  const { library } = useLoaderData<typeof loader>();
  return <LibraryDetail library={library} />;
}
```

### Action (Form Submissions)

```typescript
export async function action({ request, context }: ActionFunctionArgs) {
  const ctx = context.get(sessionContext);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const validatedData = CreateLibrarySchema.parse(data);
  const library = await libraryController.create(ctx.user.id, validatedData);
  return redirect(`/libraries/${library.id}`);
}
```

For JSON API actions, prefer parsing `request.json()` with a Zod schema (see [`backend/api-conventions.md`](../backend/api-conventions.md)). Page-level actions using `formData` follow the pattern above.

### Error Boundaries

Every route should export an `ErrorBoundary` — see `error-handling.md` for the pattern.

## Styling

- **Tailwind CSS** for all styling — utility-first approach
- **Consistent spacing** using the design system scale (see `ui/design-system.md`)
- Use `cn()` utility to merge class names
- **Mobile-first** responsive design (`sm:`, `md:`, `lg:` breakpoints)

## Icons

- **Library:** Always use `react-icons` (specifically the Material, Heroicons, or Go sets as needed).
- **Custom SVGs:** Avoid embedding raw `<svg>` tags or `img` tags for icons unless the icon is a unique brand asset not available in the library.
- **Styling:** Apply design system tokens using Tailwind classes (e.g., `<AiOutlinePhone className="text-icon-primary" />`).
- **Spinners:** Use Tailwind's `animate-spin` utility on a div with borders for simple loaders, rather than custom SVG animations.

## Performance

### Memoisation

```typescript
const summary = useMemo(() => ({
  total: artifacts.length,
  ready: artifacts.filter(a => a.uploadStatus === 'ready').length,
}), [artifacts]);
```

### Lazy Loading

```typescript
const ChatAnalytics = lazy(() => import('@components/domain/chat/ChatAnalytics'));

<Suspense fallback={<LoadingSkeleton />}>
  <ChatAnalytics />
</Suspense>
```

## Accessibility

- **WCAG 2.1 AA compliance** minimum
- Use semantic HTML elements
- Include `aria-label` props on interactive elements
- Handle focus states properly
- Ensure keyboard navigation works
