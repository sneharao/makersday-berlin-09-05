# Design Domain Model

Guide an agent and engineer through a domain-driven design session that produces or updates the harness knowledge artifacts for a bounded context. Use this skill for any of the following intentions:

- **Creating a new bounded context** — the context does not yet exist in the domain knowledge folder.
- **Updating an existing bounded context** — adding or changing aggregates, entities, value objects, invariants, or relationships.
- **Targeted model edit** — adding a single aggregate root, a value object, a field, or correcting an invariant without restructuring the whole context.

If your work crosses into a code category not covered by this skill (e.g. you start implementing entities in code while designing the model), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Mode: co-designer

The agent acts as a co-designer throughout this skill, not a code generator. Concretely:

- **Facilitate, do not dictate.** The engineer owns every domain decision. The agent owns the DDD rigour — it challenges, proposes alternatives, and explains trade-offs, but never overwrites the engineer's intent.
- **Structured questions first, edits second.** Before touching any file, gather all information needed for that step as one coherent question batch. Do not drip one question at a time. Use `AskQuestion` when the decision has a known closed set ("aggregate root or internal entity?", "soft or hard delete?"); ask a free-form question in plain text when the answer is genuinely open.
- **Summarise and confirm after every artifact edit.** After writing or updating a file, describe what changed in a short bullet list and explicitly invite the engineer to correct anything before moving to the next step.
- **Apply DDD guardrails throughout.** Call out any pattern that violates the rules at the bottom of this skill at the moment it is observed, explain why it is a problem, and propose an alternative. Do not silently accept anaemic models, leaky aggregates, or duplicated truth across artifacts.

---

## Prerequisites

Read all of the following before doing anything else:

- `harness/knowledge/domain/index.md` — routing guide to the domain knowledge folder and diagramming conventions (node colours, line styles, reusable Mermaid snippets). All diagrams produced by this skill must conform to these conventions.
- `harness/knowledge/domain/context-map.md` — current high-level map of bounded contexts, aggregate roots, and inter-context relationships.
- `harness/knowledge/domain/shared-language.md` — terms that genuinely span every context.
- For every existing context being touched: its `<context>/domain-model.md`, `<context>/language.md`, and (when the work reaches persistence) `<context>/data-model.md`.
- `harness/skills/development/add-domain-entity.md` — the persistence-side contract that Step 3 of this skill must respect: per-user scoping patterns, the two acceptable shapes (direct vs derived via parent), and repository conventions.

---

## Step 0 — Intake (gate)

Do not proceed until every item below is confirmed. Missing inputs are the most common cause of a low-quality design session.

**Required inputs:**

1. **`gr_xxx` ticket file** — read the ticket markdown file the engineer references (e.g. `jira-tickets/todo/gr_001_login_screen.md`). Its description and acceptance criteria define the scope of the session. If no ticket is provided, ask for one; do not infer scope from a vague verbal description alone.
2. **Intent classification** — is this a new context, an update to an existing context, or a targeted edit? The answer determines which of Steps 1, 2, and 3 actually run (all three may run, or only one).
3. **Affected contexts** — which bounded context(s) are in scope? Is the work inside an existing context or does it introduce a new one?
4. **Source material** — any diagrams, whiteboard shots, wireframes, or referenced specs attached to the ticket or shared by the engineer. Ingest these before asking questions; they typically answer several questions the engineer would otherwise have to type out.

If any required input is missing, stop and ask for it before proceeding.

After gathering the inputs, state the scope back to the engineer in one short paragraph ("We are creating/updating X context. The affected artifacts are Y. Steps 1/2/3 will all run / only Step 2 will run / …"). Get explicit confirmation before starting Step 1.

---

## Step 1 — High-level alignment

**Run this step when** the change introduces, renames, removes, or re-scopes a bounded context, an aggregate root visible from outside its context, or a cross-context term or reference.

Skip this step (and note you are skipping it) for purely intra-context changes where no cross-context relationship, shared-language term, or aggregate root listing is affected.

### 1a — Classify the high-level change

Determine which of the following applies (multiple may apply simultaneously):

- New bounded context — a region of the model that did not exist before.
- New aggregate root — an existing context gains an aggregate root that other contexts will reference by id.
- New cross-context reference — an existing aggregate in another context will begin carrying an id from this context.
- New shared-language term — a concept that genuinely has the same meaning across all contexts.
- Renamed, removed, or re-scoped existing element.

### 1b — Facilitation questions for Step 1

Ask as one batch, only the questions relevant to the classified change(s):

- Which context owns the new or changed element?
- What upstream/downstream relationship does this context have with its neighbours (customer/supplier, conformist, shared kernel, separate ways)?
- How will other contexts reference this element — by which id field name?
- Does the concept belong in `shared-language.md` (it means the same thing to every context), or only in one context's `language.md`?
- For any cross-context reference id: will the referencing aggregate carry the id directly (direct user-scoping shape), or is it a child of another aggregate that already carries the id (derived shape)?

### 1c — Edits

Update `harness/knowledge/domain/context-map.md` and `harness/knowledge/domain/shared-language.md` as appropriate:

- In `context-map.md`: update the Bounded Contexts table, the Aggregate Roots table, the inter-context relationships section, the diagram, and the Per-User Scoping section. Follow the `flowchart TB` diagram conventions from `index.md#diagramming-conventions`.
- In `shared-language.md`: add or update only terms that genuinely span all contexts.

**DDD guardrails for Step 1:**
- One aggregate root per aggregate — an aggregate has exactly one entry point for outside references.
- Cross-context references must be by id only. No direct entity import or object graph crossing a context boundary.
- If a term means something subtly different in two contexts, it is two terms, each owned by its context's `language.md`.

---

## Step 2 — Bounded-context model and language

**Run this step when** any aggregate, entity, value object, invariant, or behaviour inside a specific bounded context is being introduced or changed.

This is the core facilitation loop. For each aggregate being introduced or touched, work through the sub-sections below in order.

### 2a — Shape

Determine the role of each concept being introduced:

- **Aggregate root** — an entity that is the sole entry point for external references to this cluster. Has its own repository port. Has an `id` that may be referenced by other aggregates or contexts.
- **Internal entity** — an entity owned by an aggregate root, not directly referenceable from outside the aggregate boundary.
- **Value object** — immutable, no identity of its own; defined entirely by its value. A closed enum (finite set of well-known values) or an open form (e.g. a validated string).

Ask: Is this concept looked up independently (its own repository), or is it always accessed through a parent? If independently, it is an aggregate root. If always through a parent but it has identity, it is an internal entity. If it has no identity, it is a value object.

### 2b — State

For each aggregate root or internal entity, enumerate all fields:

- Field name and what it represents.
- Type (string, number, boolean, date, enum string, array of enum strings, …).
- Cardinality: single value or multi-valued (set/list).
- Required or optional.
- Immutable-once-set, or mutable.
- On-write transform if any (e.g. lower-cased on write, trimmed).

For value objects, capture the cardinality on the owning entity (single required, single optional, set with minimum 1, …) and whether the enum is open or closed.

### 2c — Invariants

Invariants are the canonical output of `domain-model.md`. Ask the engineer what must always be true:

- What conditions must hold on creation?
- What can never change after creation (immutability invariants)?
- What uniqueness constraints exist (within the aggregate, within the context, across the platform)?
- What referential constraints exist (a field must equal the corresponding field of a related aggregate)?
- What cardinality constraints exist on multi-valued fields?

Distinguish **hard invariants** (enforced — either at the application layer or by a database index) from **soft invariants** (informational — documented but not machine-enforced). Mark each one.

Warn explicitly if an invariant can only be enforced by a cross-document database transaction. That is usually a signal that the aggregate boundary is wrong.

### 2d — Value object values

If a value object is a closed enum, enumerate every value and its meaning. These values live exclusively in `<context>/language.md` — do not put them in `domain-model.md`. `domain-model.md` will deep-link to `language.md` for the enumeration.

Ask: Are there values that are planned for the future but not active yet? If so, call them out separately; do not include them in the closed set unless they are live.

### 2e — Lifecycle

- How is the aggregate created (platform-minted id, external system event, user action)?
- How is it deleted — soft (an `isActive` or `deletedAt` flag, never physically removed) or hard (physically destroyed)? If soft, what triggers deactivation, and what operations are still valid on a deactivated record?
- Can records of this aggregate be transferred between parents (e.g. moved from one customer to another)? If not, say so as an immutability invariant.
- Are there historical references from other aggregates or contexts that must remain resolvable after deactivation?

### 2f — Cross-aggregate references

- Which foreign ids does this aggregate carry?
- Which of those ids establishes per-user scoping, and which establish a logical parent relationship?
- Is per-user scoping **direct** (the aggregate carries `user_id` itself) or **derived** (the scope is reached through a parent aggregate)? Apply the rules from `harness/skills/development/add-domain-entity.md` Step 2. Default to direct; flag derived as a deliberate choice with explicit justification.

### 2g — Edits

After all questions for a given aggregate are resolved, write or update the two artifacts:

**`<context>/domain-model.md`**
- Aggregate root section: State, Invariants (marked hard/soft), Identity sourcing, Login routing (if applicable).
- Diagram: `flowchart TB` with `subgraph` blocks per aggregate, `classDef` and `linkStyle` from `index.md#diagramming-conventions`. Include every modelled element — aggregate roots, internal entities, value objects.
- Value object subsections: cardinality and role description; deep-link to `language.md` for the enumeration.
- Boundaries section: how this context is referenced from adjacent contexts.
- Intro paragraph: summarise the context's aggregate roots and the single-path-to-user principle.

**`<context>/language.md`**
- One entry per aggregate root, internal entity, value object, and any notable cross-context term scoped to this context.
- For closed-enum value objects: every value with its meaning.

**Deduplication rule — enforce this strictly:**

| Artifact | Owns | Never contains |
|----------|------|----------------|
| `language.md` | Term definitions, value enumerations | Invariants, persistence shape |
| `domain-model.md` | Aggregate boundaries, state, invariants, behaviour | Value enumerations (deep-link), persistence shape |
| `data-model.md` | Collection layout, field types, indexes, migration | Invariants (deep-link), value enumerations (deep-link) |

---

## Step 3 — Data model

**Run this step when** the change reaches persistence — new or changed MongoDB collections, field shapes, indexes, or migration concerns.

Skip this step (and note you are skipping it) when the task is purely conceptual design with no immediate persistence change.

### 3a — Facilitation questions for Step 3

Ask as one batch:

- **Collections** — one collection per aggregate root by default. Is there a reason to embed one aggregate inside another's collection (very rare; requires a strong justification — e.g. always queried and mutated together, never referenced individually)?
- **Soft or hard delete** — confirm the lifecycle decision from Step 2 is reflected: `isActive: boolean` (default `true`) for soft-deleted aggregates; no such field for hard-deleted ones.
- **Per-user scoping pattern** — confirm direct or derived from Step 2f. For derived, confirm which parent aggregate provides the scoping path and how the repository will enforce it (e.g. resolve `Library` for the requesting `user_id` before querying its `Artifact`s).
- **Field-level storage decisions** — any field needing a special on-write transform (lower-case, trim), a default value, or a specific Mongo type that differs from its domain type?
- **Indexes** — for each collection:
  - `id` — always unique.
  - Per-user key (`user_id`) — always indexed where it exists directly.
  - Any compound index that *enforces a domain invariant* from Step 2c (e.g. `(user_id, name)` unique to enforce per-user name uniqueness). Label each compound index as either "enforces invariant: <which>" or "serves read pattern: <which query>".
  - Any multikey index (on an array field).
- **Migration strategy** — greenfield (drop and recreate; use when there is no production data to preserve) or expand-and-contract (dual-write then cutover; use when live data must survive). Document the phases.

### 3b — Edits

Write or update `<context>/data-model.md`:

- Storage section: database, ODM, identifier convention, timestamp convention, soft-delete representation, per-user scope summary.
- Collections summary table: one row per aggregate root; direct or derived scoping; soft-delete flag.
- Per-collection section: field table (field name, type, required, notes — notes are persistence-only; deep-link to `domain-model.md` for invariants and to `language.md` for enum values), indexes list.
- Per-user scoping rule section: explicit paragraph on how every read and write is user-scoped, including the derived-via-parent mechanics if used.
- Repository ports and adapters table (aggregate, port, model, adapter — file names only; do not implement here).
- Migration plan: phases (drop legacy, create collections/indexes, seed, code cutover, cross-context cleanup, rollback).

---

## Step 4 — Self-critique before hand-off

Before presenting the design as complete, run this smell check across all edited artifacts. If any smell is found, loop back to the relevant step with an explicit explanation of what needs to change.

| Smell | What to look for |
|-------|-----------------|
| **Anaemic model** | Behaviour or invariants that belong on an aggregate but have drifted into a service or are simply absent. Every field that has an invariant should have that invariant documented. |
| **Leaky aggregate** | Another context or aggregate reaches inside a non-root entity rather than going through the aggregate root. Check all cross-aggregate reference lines in the diagram. |
| **Duplicated truth** | The same field, invariant, or value enumeration stated in more than one of the three artifact files. Every fact has exactly one home. |
| **Silent user-scoping** | A user-scoped aggregate or collection with no documented user-scoping pattern. Every aggregate that is owned by a user must have a documented user-scoping path — direct or derived. |
| **Dangling reference** | A cross-aggregate reference id with no repository port planned to resolve it. If `library_id` is carried on an artifact aggregate, there must be a `LibraryRepo` that the artifact application service will use. |
| **Missing lifecycle** | An aggregate with no documented deletion behaviour. Every aggregate must explicitly state: soft delete or hard delete, and why. |

Optionally invoke `harness/skills/planning/critique-coding-plan.md` for a broader sanity check that also covers simplicity, testability, and codebase consistency.

---

## Step 5 — Hand-off

When the design is complete and the self-critique passes, declare the session finished with a short summary:

- Which files were created or updated.
- What the key design decisions were (one bullet per major decision, e.g. "Artifact aggregate uses derived user-scoping via Library").
- Any open questions or future extensions the engineer should track.
- Whether any architecturally significant decision warrants an ADR (see `harness/skills/planning/write-adr.md`).

**This skill does not commit or transition tickets.** Defer to:
- `harness/skills/development/commit-changes.md` for the git commit.
- The engineer's judgement for moving the `gr_xxx_*.md` ticket file out of `jira-tickets/todo/` into the appropriate next-stage folder once the domain design artifacts are committed.

---

## Rules

These rules apply unconditionally throughout every step of this skill. If the engineer proposes something that violates a rule, flag it immediately, explain the problem, and offer a compliant alternative. Do not silently accept violations.

- **One aggregate root per aggregate.** An aggregate has exactly one entry point for external references. Do not model two roots inside one aggregate boundary.
- **Cross-aggregate references by id only.** No entity object may cross an aggregate boundary. The only link between aggregates is an id field.
- **Cross-context references by id only.** The same rule applies at the context level.
- **Ubiquitous language is per-context.** A term belongs in `shared-language.md` only if it means the same thing — with the same semantics — in every context. When in doubt, keep it context-local.
- **Every user-scoped operation must be explicitly scoped.** Either the document carries `user_id` directly, or the user-scoping path via a parent aggregate is documented in full (including the double-lookup pattern). There is no implicit user-scoping.
- **One source of truth per concern.** `language.md` owns term definitions and value enumerations. `domain-model.md` owns invariants and behaviour. `data-model.md` owns persistence shape. Deep-link; never restate.
- **Diagrams use the shared encoding.** Copy the `classDef` and `linkStyle` snippets from `harness/knowledge/domain/index.md#diagramming-conventions` verbatim. Do not introduce new colour or shape conventions inside a context file.
- **Facilitate, do not dictate.** The engineer owns every domain decision. Surface trade-offs; do not impose.

---

## Checklist

Complete this before handing off.

- [ ] `gr_xxx_*.md` ticket file read and scope summarised; engineer confirmed the scope
- [ ] Intent classified (new context / update context / targeted edit) and steps selected accordingly
- [ ] All source material (diagrams, specs) ingested before question batches
- [ ] Step 1 ran (or explicitly skipped with reason): `context-map.md` and `shared-language.md` updated
- [ ] Step 2 ran (or explicitly skipped with reason): `<context>/domain-model.md` and `<context>/language.md` updated
- [ ] Step 3 ran (or explicitly skipped with reason): `<context>/data-model.md` updated
- [ ] No duplicated truth across the three artifact files
- [ ] Every user-scoped aggregate has a documented user-scoping pattern (direct or derived)
- [ ] All diagrams use `classDef`/`linkStyle` from `index.md#diagramming-conventions`
- [ ] Self-critique (Step 4) completed; all smells resolved
- [ ] Any architecturally significant decision offered to the engineer as an ADR candidate
- [ ] Hand-off summary delivered; `commit-changes.md` referenced for next step
