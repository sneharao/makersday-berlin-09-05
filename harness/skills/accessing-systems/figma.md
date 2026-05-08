# Accessing Figma

Use the **Figma MCP server** (`plugin-figma-figma`) for all Figma operations.

## Project

- **Team:** Flinn (`team::1172826006301945341`)

| Artifact | URL |
|----------|-----|
| Project | https://www.figma.com/files/team/1172826006301945341/project/310743242 |
| Design board | TBD — Scholastic AI Figma file URL goes here once published |

Local mockups (PNGs + exported HTML) for the current product surface area live in [`designs/`](../../../designs/) at the repo root (`library_scholastic_ai`, `chat_history_scholastic_ai`, `chat_elegant_minimal_variant`, `login_scholastic_ai`, `library_intelligence_system`).

## Design board details

- **File key:** TBD
- **Stack context:** `clientLanguages: "typescript"`, `clientFrameworks: "react,react-router"`

## Quick reference

- **Design-to-code (primary):** `get_design_context` — pass `fileKey` and `nodeId` extracted from URLs. Returns code, screenshot, and metadata.
- **Structure overview:** `get_metadata` — returns node tree in XML. Always follow up with `get_design_context` for implementation.
- **Screenshot:** `get_screenshot` — requires both `fileKey` and `nodeId`.
- **Write to Figma:** `use_figma` — read the `figma-use` skill **before** every call.
- **Search components:** `search_design_system`.
- **Auth check:** `whoami` — verify permissions if access fails.

## URL parsing

Extract `fileKey` and `nodeId` from Figma URLs:
- `figma.com/design/:fileKey/:fileName?node-id=1-2` → `fileKey`, `nodeId: "1:2"` (convert `-` to `:`)
- `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use `branchKey` as `fileKey`
