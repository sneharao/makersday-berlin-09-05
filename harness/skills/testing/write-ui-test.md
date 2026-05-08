# Write a UI Test

> **Status: stub.** No UI test runner is installed yet for Scholastic AI (no Storybook, no Vitest, no Playwright). This file is intentionally short until tooling is chosen.

## When tooling exists

Once UI testing tooling is in `package.json`, this skill should describe:

- **Component tests** for `app/ui.client/components/{common,domain,layout}/` — render, interaction, and accessibility checks for `LibraryCard`, `ArtifactList`, `ChatPanel`, `MessageBubble`, etc.
- **Hook tests** for co-located component hooks and any cross-cutting hooks (per [`code-standards/ui/react-patterns.md`](../../knowledge/code-standards/ui/react-patterns.md)).
- **Page-level tests** for `app/routes/pages/` — loaders, actions, and SSR behaviour for `libraries.tsx`, `libraries.$libraryId.tsx`, `chats.$chatId.tsx`, and the future login route.
- **End-to-end** tests covering the core user journeys: upload PDF → see artifact in library → start chat → receive grounded answer with citation.

## Until then

- Follow the patterns in [`code-standards/ui/react-patterns.md`](../../knowledge/code-standards/ui/react-patterns.md) and [`code-standards/ui/testing.md`](../../knowledge/code-standards/ui/testing.md) so components are testable when a runner lands (small, prop-driven, side-effect-free render).
- Smoke-test changes in the browser via [`skills/development/run-app-in-browser.md`](../development/run-app-in-browser.md).
- Do **not** introduce a runner ad-hoc — flag the need in [`harness/housekeeping/debt.md`](../../housekeeping/debt.md) and choose deliberately.
