# Exec Plans

This directory holds in-progress and completed coding plans produced by the Planning Agent. Each plan lives in its own subdirectory.

## Naming Convention

All plan directories follow this pattern:

```
NNN-<gr-key>-short-desc/
```

| Segment | Rules |
|---|---|
| `NNN` | Zero-padded three-digit sequence number. Determines creation order. Inspect the existing directories and increment from the highest number. |
| `<gr-key>` | The `gr_xxx` ticket key matching the markdown ticket file in `jira-tickets/todo/` (e.g. `gr_001` for `gr_001_login_screen.md`). Use `NOTICKET` if no ticket file exists. |
| `short-desc` | A brief, lowercase, hyphen-separated description of the plan's scope. Keep it under 5 words. |

Examples:
- `007-gr_001-login-screen/`
- `008-gr_004-library-pdf-upload/`
- `009-NOTICKET-fix-auth-redirect/`

## Race Policy

Two planners working in parallel may both claim the same `NNN`. This is expected and harmless. The collision is resolved at PR-merge time:

- The **second PR to be merged** must rename its directory with `git mv` before merging.
- Inspect `main` to find the next available number after the first plan merged.
- The renamed plan keeps its original `gr_xxx` key and description — only the sequence number changes.

Do not block planning work to avoid a potential collision. Resolve it at merge time.

## Directory Contents

Each plan directory typically contains:

| File | Description |
|---|---|
| `plan.md` | The finalised coding plan approved by the human. |
| `conversation-summaries.md` | Key decisions and rationale from the planning session. |
| `housekeeping_audit.md` | Created by the Housekeeping Agent after merge — deferred or dismissed PR comments. |

Additional files (screenshots, reference images, sketches) may also be present.

## Lifecycle

1. **Created** by the Planning Agent during `001_plan.md`.
2. **Read** by the Coding Agent during `002_build.md` and by the Fixer Agent during `004_apply_fixes.md`.
3. **Archived** by the Housekeeping Agent during `005_housekeeping.md` — moved to `_archive/` with `git mv` after the PR is merged.

## Archive

Completed plans live in `_archive/`. The directory name and contents are preserved — only the location changes.

```
git mv harness/exec-plans/007-gr_001-login-screen \
       harness/exec-plans/_archive/007-gr_001-login-screen
```

Do not delete exec-plan directories. The archive provides a searchable history of past decisions.
