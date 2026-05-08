# Commit

Draft a commit message, optionally get user approval, and commit.

---

## Step 1 — Draft Commit Message

1. Run `git diff --staged` and `git diff` to understand all uncommitted changes.
2. Compose a commit message in the exact format below.

### Message Format

```
<summary line>

Type: <type>

Details
- <detail bullet>
- <detail bullet>
- ...
```

#### Summary line
- Single sentence, imperative mood ("Fix X" not "Fixed X", "Add Y" not "Adds Y")
- Describes *why* the change was made, not just *what* changed
- Max 100 characters

#### Type tag
- One of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`
- Standalone line, no prefix or punctuation

#### Detail bullets
- Each bullet describes a concrete change: what was renamed, added, removed, or restructured
- Group related changes into a single bullet rather than listing every file
- Focus on concepts and intent, not file paths
- 3–7 bullets typical; fewer is fine if the change is small

#### Format notes
- Don't use double-quotes (") in the message

Present the drafted message as a single fenced text block.

---

## Step 2 — User Approval (local only)

If you are running **locally** (interactive session with a human):

- Present the drafted commit message to the user.
- Ask the user to approve or request changes.
- If they request changes, revise the message and ask again.
- Do not proceed until the user explicitly approves.

If you are running in the **cloud** (automated, no human in the loop): skip this step and proceed directly to Step 3.

---

## Step 3 — Commit

Run: `git add -A && git commit -m "<approved message>"`

Do NOT append "Authored by Cursor", "Co-authored-by", or any AI attribution to the commit message.
