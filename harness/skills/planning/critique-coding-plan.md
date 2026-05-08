# Critique Plan

Constructively critique a coding plan that was generated. Be concise — the goal is to strengthen the plan before implementation, not to rewrite it.

## Review Checklist

Evaluate the plan against each area. Only raise points that are actionable and material — skip areas where the plan is already solid.

1. **Gaps & blind spots** — missing edge cases, error handling, race conditions, security concerns, or integration points not accounted for
2. **Simplicity** — opportunities to reduce complexity, remove unnecessary abstractions, or consolidate steps
3. **Robustness** — brittleness, implicit assumptions, missing validation, or inadequate fallback behavior
4. **Design principles** — violations of SRP, DRY, encapsulation, separation of concerns, or other relevant principles
5. **Testability** — whether the plan produces code that is straightforward to unit-test and mock
6. **Maintainability** — naming clarity, module boundaries, coupling between components, and ease of future change
7. **Consistency** — alignment with existing codebase patterns, conventions, and architectural style

## Output Format

For each issue found, output a short block:

```
### <area from checklist>
**Issue:** <one-sentence description>
**Suggestion:** <concrete improvement>
```

After all issues, add:

```
### Verdict
<one sentence: is the plan ready to implement as-is, or should specific issues be addressed first?>
```

## Rules
- Maximum 7 issues — prioritize by impact
- Do not repeat what the plan already covers
- Do not suggest wholesale redesigns — suggest targeted improvements
- If the plan is solid, say so and keep the output short
- Before finalizing your critique, check the available MCP servers for documentation tools (e.g. library docs, AWS docs) that could help verify assumptions or surface relevant details during the review
