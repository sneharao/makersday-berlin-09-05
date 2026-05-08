# 002 — Build

## What This Is

This is a set of instructions you must adopt and execute, not background context. When you are told to read and execute this file, you become the Coding Agent. Follow the execution steps below in order.

## Purpose

Implement the coding plan that was produced in the planning stage, verify your work against all local checks, and push clean, passing code to the branch.

## Context You Have Access To

### Coding Agent Harness and Internal Context

Read the `AGENTS.md` to understand the context and guidance you should draw from provided by the agent harness.

### Planning Artifacts

The execution plan created by the planning agent for this branch must be used, as found at:

- `harness/exec-plans/NNN-<gr-key>-short-desc/plan.md` — the approved coding plan. This is your primary instruction set.
- `harness/exec-plans/NNN-<gr-key>-short-desc/conversation-summaries.md` — key decisions and rationale from the planning session. Use this to understand intent and trade-offs behind the plan.

Identify the correct directory by inspecting `harness/exec-plans/` on the current branch.

### External Context

Fetch as needed during the planning session:

- **Design artifacts** (Figma)
- **Task definition** — `gr_xxx_*.md` markdown ticket files in `jira-tickets/todo/` (treat the folder name `jira-tickets/` as legacy)

See the skills section on accessing these systems

## Execution Steps

Follow these steps in order.

### Step 1 — Verify You Are in an Edit-Capable Mode

Confirm that your current runtime mode supports writing files and running shell commands. If it does not, switch to one that does before proceeding.

### Step 2 — Read the Plan

Read the plan and conversation summaries to fully understand the full scope before writing any code. If anything in the plan is ambiguous, check the conversation summaries for clarification.

If your work crosses into a code category not covered by the relevant skill (e.g. you start touching a gateway while implementing a domain change), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

### Step 3 — Implement → Verify → Fix Loop

Execute the following loop until all checks pass:

#### 3a. Implement

Implement the functionality laid out in the plan. Follow the implementation approach, file structure, and patterns specified. Respect all guidance as provided by the agent harness, pulling actively from it as needed throughout your implementation.

Use TDD according to the TDD skill for new feature development.

#### 3b. Verify Functionality

Verify that what you built actually works and meets the success criteria in the plan:

- Cross-reference your implementation against the plan's acceptance criteria — does every criterion pass?
- Use available tools (e.g. browser, API client) to manually exercise the feature end-to-end.
- Check edge cases and error paths called out in the plan.

#### 3c. Conformance Self-Review

Before running automated checks, perform a manual conformance pass over every file you changed. This is a required step — it is not covered by the linter alone.

For each of the three areas below, **read the referenced harness file now** and derive the applicable checks from it against your diff. Do not rely on memory — the source files are the authority.

**Dependency rules** — read `harness/knowledge/repo-architecture/dependency-rules.md`, section "What is NOT enforced programmatically". For every rule listed there, determine whether this diff touches it and verify accordingly.

**Code standards** — read `harness/knowledge/code-standards/_index.md` and follow its pointers to whichever sub-files (naming conventions, error handling, API conventions, etc.) are relevant to what you changed. Verify each applicable rule.

**Domain language** — read `harness/knowledge/domain/<context>/` files for every bounded context your diff touches. Verify that new types, functions, and file names use the ubiquitous language of those contexts and that no domain terms are silently renamed.

**Citation requirement:** For every conformance item above that applies to your diff, add a one-line citation in the PR body under a `## Conformance` heading:

```
- <rule-name> — harness/knowledge/path/to/file.md
```

If a rule does not apply to this diff, do not cite it. If you verify a rule and it passes, still cite it so the reviewer knows it was checked.

#### 3d. Verify Checks

Run all local checks to confirm the new code passes automated enforcement:

- **Test suite** — all existing and new tests must pass.
- **Linting + type checking** — zero errors.

#### 3e. Fix if needed

If any verification step fails (functionality, conformance, or automated checks), diagnose the issue and fix it. Do not skip or suppress failures. Return to 3a if the fix requires further implementation changes.

#### Loop Exit

Exit the loop only when: **all automated checks pass with zero failures** AND **the Conformance Self-Review checklist in the PR body is complete**.

### Step 4 — Human Review

**Stop here and wait for human approval before proceeding.**

Present a summary of the changes made, including:

- What was implemented and why
- Any notable decisions or trade-offs taken during implementation
- Confirmation that all checks pass
- The completed `## Conformance` section from the PR body

Then explicitly ask the human to review and confirm they are happy with the changes. The human may:

- **Approve** — proceed to Step 5.
- **Request changes or iterations** — implement the requested changes and return to the Step 3 loop until checks pass again, then return to this step.

Do not proceed to Step 5 until the human has explicitly confirmed they are satisfied.

### Step 5 — Commit and Push

1. **Commit** with a clear message. See the committing changes skill for instructions.
2. **Push** the commits to Github at the current branch.

### Step 6 — Move the Ticket File to the Next Stage

If any `gr_xxx_*.md` ticket files were worked on during this session, move each one out of `jira-tickets/todo/` into the folder representing the next workflow stage (e.g. `jira-tickets/in-review/` or `jira-tickets/done/`, depending on the project's current convention). If no such folder exists yet, create one alongside `todo/` and note it briefly in the PR body so the convention is visible.

## Done

Your work is complete when the code is pushed, all local checks pass, the Conformance Self-Review is documented in the PR body, and any related `gr_xxx_*.md` ticket files have been moved out of `jira-tickets/todo/`.
