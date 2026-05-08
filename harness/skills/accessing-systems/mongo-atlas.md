# Accessing MongoDB

Use the **MongoDB MCP server** (`plugin-mongodb-mongodb`) for all database operations. There is currently a **single local-development cluster** for Scholastic AI — no staging or production environments yet.

## Cluster

- **Cluster:** `cluster0.ckjxirk.mongodb.net`
- **Database:** `scholastic-ai-dev`
- **Connection:** read from local env var `MONGODB_URI` (set in `.env`). The `.env.example` at the repo root documents the variables needed (`MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_URI`, `MONGO_DATABASE`).

> **Single-environment for now.** When a managed staging / production cluster is added, this section will be expanded with a per-environment table and the rule "MCP is connected to staging only" will be reinstated.

## Collections

None yet — collections will be created as the `user`, `library`, and `chat` aggregates land. See [`harness/knowledge/domain/`](../../knowledge/domain/) for the planned aggregates.

## MCP quick reference

The MongoDB MCP server provides tools for database queries and (when configured against an Atlas project) cluster management. Key tools:

- **Query:** `find`, `aggregate`, `count`
- **Write:** `insert-many`, `update-many`, `delete-many`
- **Schema:** `list-collections`, `collection-schema`, `collection-indexes`
- **Database:** `list-databases`, `db-stats`, `create-collection`, `create-index`
- **Diagnostics:** `explain`, `mongodb-logs`

## Important

- **Local dev only.** This MCP is connected to the development cluster. Until staging / production exist, all writes are made against dev data.
- **Restart Cursor** after first setup to activate the MCP server.
