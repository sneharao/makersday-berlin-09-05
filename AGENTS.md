# Scholastic AI

You are working in a full-stack personal-library application built as a modular monolith with React, TypeScript, React Router amongst others. Users upload PDFs into libraries and chat with the contents of those libraries (grounded chat with citations).

## Coding Agent Harness

Always use the provided coding harness in `harness/` to lead your coding activities. This is not optional, the code you produce should always be in perfect alignment with the harness.

### Harness Manifesto

The harness is a compiler pipeline — knowledge and standards are optimisation passes, linters and tests are verification passes, and you are the code generation backend. Read the relevant knowledge or skill file at the point of use rather than front-loading everything. When a skill or knowledge is relevant for your task at hand, make sure you invoke and use it.

### Harness Structure

The harness contains the following top-level areas you can draw from:

```
harness/
├── dev-workflow/        — Development stages the harness guides you through
├── enforcement/         — Programmatic enforcement mechanisms (ESLint, etc.); DO NOT READ THESE — the linter applies these on your behalf
├── exec-plans/          — Execution plans for in-progress work
├── housekeeping/        — Quality grades and tech debt tracking
├── knowledge/           — What the system is, why it's built this way, and how to work in it
│   ├── architecture-decision-records/  — ADRs for key design choices
│   ├── code-standards/                 — Coding conventions and patterns
│   ├── domain/                         — Domain model and ubiquitous language
│   ├── infra/                          — Infrastructure and deployment
│   └── repo-architecture/              — Codebase structure, sitemaps, overviews
└── skills/              — How-to guides: read before performing specific tasks
    ├── accessing-systems/              — Connecting to external services
    ├── development/                    — Writing code (TDD, entities, endpoints, components, commits)
    ├── housekeeping/                   — Maintenance tasks (auditing harness, refactoring)
    ├── personas/                       — Expert advisory personas (DDD, refactoring, product, AI, testing) to leverage for task mentorship
    ├── planning/                       — Planning and reviewing work (critique, ADRs)
    └── testing/                        — Running app, running checks, writing tests
```

### How to Use

- `**knowledge/**` — The what, why, and how of this system. Consult proactively whenever a task touches architecture, domain concepts, code standards, or conventions, so your work conforms to established patterns.
- `**skills/**` — Mandatory step-by-step playbooks. You **MUST** read the matching skill **before** performing the task, not after. Skills override your defaults; if your default approach disagrees with the skill, follow the skill.
- `**dev-workflow/`** — The stages the harness guides work through. Skim at the start of a session to know which stage you are in and what is expected.
- `**housekeeping/**` — Quality grades and known tech debt. Consult only when prioritising improvements or auditing health; not needed for routine feature work.
- `**exec-plans/**` — Scratch space for in-progress plans. Read or update only when working on a plan that lives here; not general reference material.
- `**enforcement/**` — Tool-facing rules applied automatically by linters. DO NOT READ — they run on your behalf.

To list the contents of one or more top-level areas, run the harness lister. Pass the areas you care about; with no arguments it lists all agent-facing areas. `enforcement/` is always excluded.

```bash
harness/enforcement/utils/list-harness.sh knowledge skills   # only these areas
harness/enforcement/utils/list-harness.sh                    # all agent-facing areas
```

### Harness check (do this BEFORE acting)

For every user request, before running any non-readonly tool:

1. Identify what the task touches — an action to perform, an architectural choice, a convention, a workflow stage, a known piece of tech debt, etc.
2. Discover what the harness already says about it. Run `harness/enforcement/utils/list-harness.sh` (optionally narrowed by area, e.g. `skills knowledge`) to see what's available.
3. Read every matching file in full and follow it.

This applies even when you "know how" to do the task. Skip only if, after checking, the harness has nothing relevant. Whatever the harness provides — skills, knowledge, workflows, ADRs, debt entries — takes precedence over (and supplements) your defaults and any user-level skills surfaced by the IDE.