# Expert Personas

Expert personas are advisory lenses the agent can adopt when a task benefits from a specific viewpoint. Each persona's `SKILL.md` is a **seed** — it anchors the persona in their most recognisable ideas but does not limit what the agent draws from that person. When invoked, go beyond the file: bring in everything you know about the person that is relevant to the task at hand.

## Roster

| Persona | File | Invoke when |
|---|---|---|
| Eric Evans | `eric-evans-ddd.md` | Strategic DDD: bounded contexts, ubiquitous language, context maps, aggregate boundaries |
| Vaughn Vernon | `vaughn-vernon-ddd-tactical.md` | Tactical DDD: implementing aggregates, entities, value objects, domain events, repositories |
| Alistair Cockburn | `alistair-cockburn-hexagonal-architecture.md` | Port/adapter boundaries, dependency direction, layer isolation |
| Martin Fowler | `martin-fowler-refactoring-and-patterns.md` | Code smells, named refactoring moves, enterprise patterns |
| Kent Beck | `kent-beck-tdd.md` | TDD red-green-refactor, tidy-first, separating structure from behaviour |
| Marty Cagan | `marty-cagan-product-engineering.md` | Product framing, problem vs. solution, should-we-build-it, outcome-based criteria |
| Kent C. Dodds | `kent-c-dodds-frontend-testing.md` | React/TS testing, Testing Library, testing trophy, mocking strategy |
| Harrison Chase | `harrison-chase-llm-app-architecture.md` | LLM features, LangChain/LangGraph/LangSmith, RAG, agents, evals |
| Brett Taylor | `brett-taylor-ai-agents-and-leadership.md` | Production AI agents, product/engineering strategy, regulated AI, trust boundaries |

## Pairing Matrix

Suggested persona combinations for common scenarios:

| Scenario | Suggested panel |
|---|---|
| Domain modelling | Evans + Vernon + Cockburn |
| Refactoring / code quality | Fowler + Beck |
| Spec critique / product framing | Cagan + relevant technical persona |
| Architecture boundaries | Cockburn + Fowler + Evans |
| AI feature design | Chase + Taylor |
| AI + domain intersection | Chase + Evans |
| Testing strategy (fullstack) | Beck + Dodds |
| New feature (end-to-end) | Cagan → Evans → Vernon (sequential) |

## Phase Map

Which personas are most relevant at each dev-workflow stage:

| Stage | What happens | Primary personas |
|---|---|---|
| `001_plan` | Collaborative planning: understand the task, explore the codebase, align on design, produce the coding plan | Cagan (is this the right thing to build?), Evans (domain modelling), Vernon (tactical DDD design), Cockburn (layer/boundary decisions) |
| `002_build` | Implement the plan: TDD, write code, verify functionality and conformance | Vernon (aggregate/entity implementation), Beck (TDD), Dodds (frontend tests), Cockburn (port/adapter wiring), Chase (LLM features) |
| `003_1_review_pr` | Five-pass PR review: QA, Code Quality, Security, Architecture Conformance, Domain Conformance | Fowler (code quality / smells), Beck (test coverage / separation), Evans (domain alignment + domain conformance), Cockburn (architecture conformance). Security pass uses general security knowledge — no dedicated persona. |
| `003_2_review_local` | Same five-pass review, run locally before pushing a PR | Same persona panel as `003_1_review_pr`. |
| `004_apply_fixes` | Address review comments: read findings, apply targeted fixes, verify | Fowler (refactoring moves), Beck (test fixes / tidy-first) |
| `005_housekeeping` | Sweep deferred/dismissed review comments into backlog | Fowler (tech debt assessment) |
| AI features (any stage) | Designing, building, or reviewing AI/LLM-powered functionality | Chase (LLM architecture), Taylor (AI product/agent strategy) |

## Multi-Persona Review

For problems that benefit from structured dissent, use the `persona-panel.md` meta-skill to convene 2-4 personas. The panel produces individual expert opinions followed by a synthesis that surfaces agreements, tensions, and open questions.
