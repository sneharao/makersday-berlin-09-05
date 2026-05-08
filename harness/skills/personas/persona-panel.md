---
name: persona-panel
display_name: Persona Panel
discipline: Multi-persona review
description: Invoke when you want 2-4 expert perspectives on a design decision, ADR, refactoring plan, spec, or contentious technical choice. Produces structured opinions from multiple personas so you can weigh trade-offs and surface disagreements.
---

# Persona Panel — Multi-Persona Review

> Convene a panel of expert personas to critique a problem from multiple angles, surfacing disagreements and trade-offs.

## Important: this is a seed, not a ceiling

The panel structure below is a starting framework. Adapt it: if a problem only needs two personas, use two. If a persona's opinion is obvious ("they'd agree"), note it briefly and spend depth where the tension is. The goal is decision quality, not ceremony.

## Invoke when

- Before writing an ADR — get competing perspectives
- Reviewing a spec for feasibility and design fit
- Contentious PR or refactoring where one viewpoint feels insufficient
- Any "should we X or Y?" question that benefits from structured dissent
- Cross-cutting concerns that span multiple disciplines (e.g., an AI feature that touches the domain model and needs frontend testing)

## How it works

### 1. Read the problem statement

Understand what's being decided, what the context is, and what the options are.

### 2. Select 2-4 personas

Choose from the roster based on relevance. **Prefer personas that will disagree** — that's where the value is. Consult the pairing matrix in `harness/skills/personas/README.md` for suggested combinations, or choose based on the task:

| Problem domain | Likely panel |
|---|---|
| Domain modelling | Evans + Vernon + Cockburn |
| Refactoring plan | Fowler + Beck |
| Spec / should-we-build-it | Cagan + relevant technical persona |
| AI feature design | Chase + Taylor |
| Architecture boundary | Cockburn + Fowler + Evans |
| Fullstack / cross-cutting | Pick one from each layer touched |
| AI + domain intersection | Chase + Evans |
| Testing strategy | Beck + Dodds |

### 3. Load each selected persona's SKILL.md

Read it in full. Remember: each persona file is a seed — bring in everything you know about that person beyond the file.

### 4. Produce individual opinions

For each persona, produce output in the standard format:

**As \<Persona Name\>:**
- **Diagnosis:** \<what they see in this situation\>
- **Recommendation:** \<their preferred approach, with named moves\>
- **Trade-offs:** \<what their approach costs\>
- **Disagreements with the panel:** \<where they'd push back on the others\>

### 5. Synthesise a panel summary

After all individual opinions:

**Panel Summary:**
- **Points of agreement:** \<where personas align\>
- **Key tensions:** \<where they disagree and why\>
- **Recommended path:** \<the synthesis — what to do given the trade-offs\>
- **Open questions:** \<what the panel can't resolve — needs user input\>
