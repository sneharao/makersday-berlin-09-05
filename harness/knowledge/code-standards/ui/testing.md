# UI Testing

How to test frontend components, interactions, and workflows. For backend testing conventions, see `backend/testing.md`.

**Skill:** When writing a UI test, follow `skills/testing/write-ui-test.md`.

> **Status: TBD.** Scholastic AI does not yet have a UI test runner installed (no Storybook, no Vitest, no Playwright, no `@testing-library/*`). This file describes the *intended* layered approach so production code is shaped to be testable when one is wired up. When tooling lands, replace each "TBD" section with the actual tool, config file, and commands.

## Test Directory Structure (planned)

```
app/ui.client/
│   └── **/*.stories.tsx    # Component-render + interaction tests, when adopted (e.g. Storybook + Vitest)
tests/
├── ui/                     # Unit tests for hooks and utilities
└── e2e/                    # End-to-end browser tests
```

## Testing Layers (planned)

| Layer                | Tool        | What It Tests                                  | Speed |
| -------------------- | ----------- | ---------------------------------------------- | ----- |
| Render & interaction | TBD         | Component renders, states, user interactions   | Fast  |
| Logic & hooks        | TBD         | Pure functions, custom hooks, data transforms  | Fast  |
| Workflows            | TBD         | Cross-page flows, auth, critical user journeys | Slow  |

Pick the **lowest-cost tool** that covers the behaviour. Most UI testing should happen at the component-render layer; reach for end-to-end tests only when you need a real browser navigating real routes (e.g. upload a PDF → see the artifact appear → start a chat → receive a grounded answer).

## Component Render & Interaction Tests (planned)

Once a runner is chosen, prefer it for everything that touches the DOM. Render-tests cover every meaningful visual state; interaction tests cover form/click/keyboard flows.

```typescript
// Example shape — replace with the chosen tool's API
export const Empty: Story = {
  args: { artifacts: [] },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const WithError: Story = {
  args: { error: 'Failed to load libraries' },
};
```

```typescript
// Example interaction — replace with the chosen tool's API
export const SubmitsNewChat: Story = {
  args: {
    onSubmit: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    const input = canvas.getByLabelText('Title');
    await userEvent.type(input, 'New chat');

    const submit = canvas.getByRole('button', { name: 'Start' });
    await userEvent.click(submit);

    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New chat' }),
    );
  },
};
```

## Hook & Pure-Function Tests (planned)

For logic that doesn't require rendering a component (custom hooks, formatters, validators, derived selectors), use a unit-test runner:

```typescript
import { renderHook, act } from '@testing-library/react';

describe('useLibraryFilters', () => {
  it('applies upload-status filter', () => {
    const { result } = renderHook(() => useLibraryFilters(libraries));

    act(() => {
      result.current.setStatusFilter('ready');
    });

    expect(result.current.filtered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uploadStatus: 'ready' }),
      ]),
    );
  });
});
```

### File Naming

- `{module-name}.test.ts` for unit tests.
- Place alongside the code they test or under `tests/ui/`.

## End-to-End Tests (planned)

Use end-to-end tests for the critical user journeys that span multiple pages:

- Login → see empty library list.
- Create library → upload PDF → see artifact appear as `ready`.
- Open library → start chat → receive answer with citation linking back to the artifact.

```typescript
// Example shape — replace with the chosen tool's API
test('user can create a chat in a library and see a grounded answer', async ({ page }) => {
  await page.goto('/libraries');
  await page.getByRole('button', { name: 'New library' }).click();
  // ... happy path through upload + chat ...
  await expect(page).toHaveURL(/\/chats\/[\w-]+/);
});
```

### File Naming

- `{feature-name}.e2e.test.ts`
- Place under `tests/e2e/`.

## What to Test Where — Decision Guide

| Question                                                      | Tool (planned)            |
| ------------------------------------------------------------- | ------------------------- |
| Does this component render correctly in all its states?       | Component-render test     |
| Does clicking/typing produce the right UI change or callback? | Interaction test          |
| Is this a pure function or custom hook with no DOM?           | Unit-test runner          |
| Does this workflow span multiple pages or need a live server? | End-to-end test           |
