# Design System Usage Guide

## Architecture

```
tailwind.css (:root CSS variables)  →  tailwind.config.ts (maps vars to utilities)  →  Components (.tsx)
```

CSS custom properties in `:root` are the **single source of truth**. Tailwind config references them via `var()`. No TypeScript token files exist.

## Token Tiers

| Tier | Naming | Example | Used in components? |
|------|--------|---------|---------------------|
| **Primitive** | `--color-{palette}-{shade}` | `--color-gray-500: #909090` | Never |
| **Semantic** | `--{role}-{variant}` | `--text-subtle: var(--color-gray-500)` | Always (via Tailwind) |

Primitives define raw palette values. Semantic tokens reference primitives and encode purpose. Components only use semantic tokens through Tailwind utility classes.

## Class Naming Patterns

| Purpose | Pattern | Example |
|---------|---------|---------|
| Background | `bg-surface-{variant}` | `bg-surface-primary`, `bg-surface-secondary` |
| Text colour | `text-text-{variant}` | `text-text-default`, `text-text-subtle`, `text-text-danger` |
| Border colour | `border-border-{variant}` | `border-border-tertiary`, `border-border-accent` |
| Icon colour | `text-icon-{variant}` | `text-icon-secondary`, `text-icon-accent` |
| Accent bg | `bg-accent-{variant}` | `bg-accent`, `bg-accent-light` |
| Danger bg | `bg-danger-{variant}` | `bg-danger`, `bg-danger-lightest` |
| Warning bg | `bg-warning-light` | `bg-warning-light` |
| AI bg | `bg-ai-{variant}` | `bg-ai`, `bg-ai-lightest` |
| Elevation | `shadow-{size}` | `shadow-sm`, `shadow-md`, `shadow-lg` |
| Spacing | `{property}-{scale}` | `p-m`, `gap-s`, `mt-xl` |
| Typography | `font-{family} text-{size}` | `font-primary text-s` |
| Border radius | `rounded-{size}` | `rounded`, `rounded-l`, `rounded-xl` |
| Scrim/overlay | `bg-scrim-{variant}` | `bg-scrim-heavy` |

## Do / Don't

```tsx
// DO — semantic tokens
<div className="bg-surface-secondary text-text-subtle border border-border-tertiary">

// DON'T — raw Tailwind palette
<div className="bg-gray-100 text-gray-500 border border-gray-300">

// DO — semantic accent
<button className="bg-accent hover:bg-accent-dark text-text-inverted">

// DON'T — hardcoded hex or raw palette
<button className="bg-[#2B82B5] hover:bg-[#236B96] text-white">

// DO — semantic error
<p className="text-text-danger">Error occurred</p>

// DON'T — raw red
<p className="text-red-700">Error occurred</p>

// DO — design system spacing
<div className="p-m gap-s">

// DON'T — arbitrary values when a token exists
<div className="p-4 gap-3">

// DO — react-icons with semantic tokens
<AiOutlinePhone className="text-icon-primary" />

// DON'T — custom SVGs or raw palette on icons
<svg fill="#1FE49E"> ... </svg>
```

## Escape Hatches

Use `brand.*` classes for brand-specific, decorative uses only:

- `text-brand-petrol` — logo colour, brand accents
- `bg-brand-brightgreen` — decorative highlights

These bypass the semantic layer intentionally.

## Adding New Tokens

1. Add the CSS variable to `:root` in `app/ui.client/design-system/styles/tailwind.css`
   - If it's a raw colour, add under **Primitives**
   - If it's role-based, add under **Semantic Tokens** and reference a primitive
2. Map it in `tailwind.config.ts` under the appropriate `extend` key
3. Use the resulting Tailwind class in your component

## Spacing Scale

| Token | Value | Tailwind |
|-------|-------|----------|
| `--space-xxxs` | 0.125rem (2px) | `p-xxxs` |
| `--space-xxs` | 0.25rem (4px) | `p-xxs` |
| `--space-xs` | 0.5rem (8px) | `p-xs` |
| `--space-s` | 0.75rem (12px) | `p-s` |
| `--space-m` | 1rem (16px) | `p-m` |
| `--space-l` | 1.5rem (24px) | `p-l` |
| `--space-xl` | 2rem (32px) | `p-xl` |
| `--space-xxl` | 3rem (48px) | `p-xxl` |
| `--space-xxxl` | 4rem (64px) | `p-xxxl` |

Default Tailwind spacing (`p-4`, `gap-3`, etc.) remains available alongside the custom scale.
