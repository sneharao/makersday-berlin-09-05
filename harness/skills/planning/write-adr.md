# Write ADR

Write an Architecture Decision Record (ADR) to capture a significant design decision and its rationale.

---

## Prerequisites

Read `harness/knowledge/architecture-decision-records/ABOUT.md` for the purpose and lifecycle of ADRs.

---

## When to Write an ADR

Write an ADR when a decision:

- Constrains how future code is written (e.g. choosing a library, defining a pattern)
- Would be non-obvious to someone joining the project later
- Was debated between multiple viable alternatives
- Changes or supersedes an existing architectural approach

Do **not** write an ADR for routine implementation choices, bug fixes, or decisions that are already captured in code standards.

---

## Step 1 — Determine the ADR Number

List existing ADRs to find the next available number:

```bash
ls harness/knowledge/architecture-decision-records/
```

Use the pattern `NNN-short-description.md` (e.g. `004-event-driven-notifications.md`).

---

## Step 2 — Write the ADR

Create the file at `harness/knowledge/architecture-decision-records/NNN-short-description.md` using this template:

```markdown
# ADR-NNN: <Title>

| Status | Date | Supersedes | Superseded by |
|--------|------|------------|---------------|
| proposed | YYYY-MM-DD | — | — |

## Context

<What problem or need prompted this decision? What constraints exist? Keep it to 2–4 paragraphs.>

## Decisions

### Decision 1: <Short name>

<What was decided and why. Include alternatives that were considered and why they were rejected. Be specific enough that someone can understand the trade-offs without additional context.>

### Decision 2: <Short name> (if multiple related decisions)

<Same format as above.>

## Known Limitations

<What trade-offs or downsides does this decision introduce? What will need to change if assumptions shift?>

## Future Extensions

<Optional. What natural next steps does this decision enable or suggest?>

## References

<Links to talks, articles, documentation, or prior ADRs that informed the decision.>
```

---

## Step 3 — Follow the Inverted Pyramid

Structure the ADR so the most important information comes first:

1. **Title** — states the decision clearly
2. **Context** — the problem being solved (why we need to decide)
3. **Decisions** — what was decided (the answer)
4. **Known Limitations** — trade-offs and risks
5. **References** — supporting material

Keep the ADR to roughly one page. If there is extensive supporting analysis, link to it rather than inlining it.

---

## Step 4 — Handle Superseding

If this ADR supersedes an existing one:

1. Update the new ADR's `Supersedes` column to reference the old ADR number.
2. Update the old ADR's `Superseded by` column to reference the new ADR number.
3. Change the old ADR's status to `superseded`.

Never modify the body of a superseded ADR — it is a historical record. Only update the metadata table.

---

## Step 5 — Set Status

- Start with `proposed` while the decision is under discussion.
- Change to `accepted` once the team agrees and the decision is active.
- An ADR should be accepted before or at the same time as the code that implements it is merged.

---

## Step 6 — Review with the Team

Present the ADR to the human for review. ADRs are collaborative — the act of writing surfaces disagreements. Iterate on the content based on feedback before marking as `accepted`.

---

## Rules

- Keep ADRs short — one page is ideal, two pages maximum.
- Never reopen or modify an accepted ADR's body. Supersede it with a new ADR instead.
- Write in plain language. Avoid jargon that wouldn't be clear to someone joining the team.
- One decision per ADR is preferred, but tightly coupled decisions can share an ADR.
- ADRs live permanently in the repo — they are historical records, not living documents.
