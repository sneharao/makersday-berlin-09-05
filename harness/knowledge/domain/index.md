# Domain Knowledge — Routing

This folder describes the **Scholastic AI** domain — a personal digital library where a user uploads PDFs, builds libraries, and chats with them. It is organised by bounded context. Read only what your task needs.

## When to read what

1. **Always start here:** [context-map.md](context-map.md) — the high-level map of bounded contexts, aggregate roots, and inter-context relationships.
2. **To work inside a bounded context** (`user`, `library`, `chat`):
   - Read `<context>/domain-model.md` first — domain model: aggregates, entities, value objects, invariants, behaviour.
   - Then `<context>/language.md` — the ubiquitous language scoped to that context.
3. **Only when touching persistence** (repositories, schemas, migrations): also read `<context>/data-model.md`.
4. **Only for terms that genuinely span every context** (e.g. `userId`, the DDD vocabulary itself): read [shared-language.md](shared-language.md). Most language belongs in a context-specific `language.md`, not here.

## Why this shape

Bounded contexts exist precisely so the same word can mean different things in different parts of the model. Reading every context's language at once defeats the purpose. Pull the language for the context you are working in, and nothing else.

## Diagramming conventions

Diagrams in this folder use Mermaid `flowchart` blocks with a consistent visual encoding so the same colour and shape always mean the same thing across files. When adding a new diagram, copy the snippets at the bottom of this section verbatim so the encoding stays uniform.

### Node encoding

| Visual | Meaning |
|--------|---------|
| Dark-teal rectangular node with thick orange border | Aggregate root |
| Dark-teal rectangular node with thick `#60A5FA` border | Aggregate root owned by another bounded context, shown only as an external reference target |
| Dark-teal rectangular node (no orange border) | Internal entity (non-root, owned by an aggregate) |
| Light-teal rounded node | Value object |
| Dashed orange box around one or more nodes | Aggregate boundary |

### Line encoding

| Visual | Meaning |
|--------|---------|
| Solid line, no arrow (`---`) | Composition — the aggregate root owns the inner element |
| Thick dashed black arrow (`-.->`) labelled with an id field name | Cross-aggregate reference by id (e.g. `userId`, `libraryId`) |
| Solid black arrow (`-->`) labelled with a verb | Owns / produces / has relationship at the high-level context map (where aggregate boundaries are not drawn) |

### Reusable Mermaid snippets

`classDef` block — declare once near the bottom of any flowchart, then apply with `class <NodeIds> <className>`:

```
classDef agg    fill:transparent,stroke:#f59e0b,stroke-width:2.5px,stroke-dasharray:8 5
classDef root   fill:#0f5b5e,stroke:#f59e0b,stroke-width:3px,color:#ffffff
classDef externalRoot fill:#0f5b5e,stroke:#60A5FA,stroke-width:3px,color:#ffffff
classDef entity fill:#0f5b5e,stroke:#0f5b5e,color:#ffffff
classDef vo     fill:#c8d8d4,stroke:#0f5b5e,color:#000000
```

`linkStyle` recipes — one per matching link, indices vary per diagram. Mermaid numbers links in declaration order starting at 0:

```
# Cross-aggregate reference (-.-> arrows): thick dashed black, high contrast
linkStyle <n> stroke:#000000,stroke-width:5px,stroke-dasharray:10 6

# Context-map relationship arrow (--> arrows, no aggregate boxes): solid black, medium weight
linkStyle <n> stroke:#000000,stroke-width:3px
```

Composition lines (`---`) inside an aggregate use the renderer default — no `linkStyle` needed.
