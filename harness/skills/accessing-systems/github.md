# Accessing GitHub

Use the **GitHub MCP server** (`user-github`) for all GitHub operations (PRs, issues, branches, releases, code search) when one is configured.

## Repository

- **Owner:** TBD (Scholastic AI repo not yet published — update this once the remote exists).
- **Repo:** TBD

| Artifact | URL |
|----------|-----|
| Repo | TBD |
| Pull Requests | TBD |

## Quick reference

- **List PRs:** `list_pull_requests` with `owner` / `repo` once known.
- **Search PRs by author:** use `search_pull_requests` instead of `list_pull_requests`.
- **Read a PR:** `pull_request_read`.
- **Create a PR:** `create_pull_request`.
- **Issues:** `list_issues`, `issue_read`, `search_issues`.
- **Branches/commits:** `list_branches`, `list_commits`, `get_commit`.
- **Code search:** `search_code`.

Note: `gh` CLI is not installed — always use the MCP tools when one is wired up.
