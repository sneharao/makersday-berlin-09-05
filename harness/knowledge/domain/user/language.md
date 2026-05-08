# User — Ubiquitous Language

Terms scoped to the `user` bounded context. Use these terms exactly as defined here in code, comments, commit messages, and conversation when working in this context. Do not import these meanings into other contexts.

For terms that span all contexts (`User`, `userId`), see [shared-language.md](../shared-language.md). The cross-context entries there state only what other contexts need; this file is the authoritative, full definition for everything inside `user`.

## Identity

### User

A human who logs into Scholastic AI. The unit of multi-tenancy. An aggregate root in this context. Identified by an internal UUID; the auth provider's stable per-user identifier is carried separately as `authSubject.subjectId`, and the human-facing identifier is `email`. Users are deactivated, never hard-deleted, because the `library` and `chat` contexts hold historical references to them.

### Email

A field on `User` (a single required `Email` value object). The user's login identifier and the human-facing bridge between the auth provider and the platform. Validated as a syntactically well-formed email address. Stored lower-cased; comparisons are case-insensitive. Unique platform-wide.

### DisplayName

A field on `User` (a single required `DisplayName` value object). The name shown in the app shell next to the avatar. Trimmed on write; non-empty after trim. No uniqueness constraint — two users may legitimately share a display name.

## User Preferences

### Locale

The user's preferred BCP 47 locale tag, held on `User` as `locale`. **Closed enum, exactly one value, required.** Drives UI language and date/number/currency formatting. Values follow BCP 47 (`<language>-<REGION>`, region uppercased):

- `en-US` — English, United States
- `en-GB` — English, United Kingdom
- `de-DE` — German, Germany
- `fr-FR` — French, France
- `es-ES` — Spanish, Spain
- `it-IT` — Italian, Italy
- `zh-CN` — Chinese (Simplified), China

The active list is intentionally short for the first iteration. Add a value here, and only here, when adding support for a new locale. Code that switches on `Locale` must handle every value in this list — there is no `default` fallback.

## Authentication

### Auth Provider

The platform delegates authentication to a third-party provider. The vocabulary at the field/code level is intentionally provider-agnostic (`authSubject`, `subjectId`, `provider`) so that the `user` context does not depend on a specific provider's SDK shape. The provider is named only as a value of the `AuthProvider` enum.

### AuthSubject

A field on `User` (a single required `AuthSubject` value object). The auth provider's stable per-user identifier, paired with the provider name. Two fields:

- `provider` — an `AuthProvider` enum value (see below).
- `subjectId` — the opaque string the provider issued for this person. Treated as opaque inside the platform; never parsed.

The pair `(provider, subjectId)` is unique platform-wide and is the machine-facing identity bridge between the auth provider and the platform. It is **distinct from** `email`: `email` may change over time, but `(provider, subjectId)` does not — once a provider mints a subject id for a person, it is stable for the life of that account in that provider.

### AuthProvider

The provider that minted an `AuthSubject.subjectId`. **Closed enum, exactly one value, required (only inside `AuthSubject`).** Values:

- `local` — placeholder for development/test users with no upstream provider; `subjectId` is platform-minted in this case. Not used in production.

The active list is intentionally one entry while the platform is provider-agnostic. When the production auth provider is selected, add a value here (e.g. `stytch`, `supabase`, `auth0`) — and only here. The choice does not propagate into field names, types, or repositories.

### `authSubjectId`

Sometimes used informally as shorthand for `authSubject.subjectId` in conversation. The canonical field path is the nested form; only the nested form appears in code.

## Lifecycle

### `isActive`

A field on `User`. `true` for active users; `false` for deactivated. Soft-delete flag — users are never hard-deleted, because the `library` and `chat` contexts may reference them historically by `userId` and those references must remain resolvable.
