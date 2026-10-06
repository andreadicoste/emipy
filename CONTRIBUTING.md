# Contributing to Emipy

Thanks for taking the time to contribute.

Emipy is an educational programming environment with several browser runtimes, a structured curriculum and AI-assisted learning features. Changes should preserve a few core properties: student code stays isolated from the application server, runtime behavior is deterministic enough for teaching, and curriculum rules remain explicit and testable.

## Development setup

Requirements:

- Bun 1.4.2+
- A modern Chromium-based browser for the full end-to-end test suite

Clone and prepare the project:

```sh
git clone https://github.com/andreadicoste/emipy.git
cd emipy

bun install --frozen-lockfile
cp .env.example .env

mkdir -p data
touch data/emipy.db

bun run db:generate
bun run db:deploy
bun run dev
```

The first C/C++ build downloads the pinned compiler/runtime assets and verifies their SHA-256 checksums.

## Before opening a pull request

Run:

```sh
bun run content:validate
bun run typecheck
bun run build
bun test
```

For browser-facing changes, also run the relevant Playwright tests:

```sh
bunx playwright install chromium
bunx playwright test
```

Some authenticated E2E tests require a running server and dedicated test credentials. Never point them at a production database.

## Project conventions

### Runtime changes

A language runtime should:

- execute inside a dedicated Web Worker;
- support STOP by terminating the Worker;
- enforce explicit time, memory/output or capability limits where practical;
- avoid exposing browser/network capabilities that are outside the educational console environment;
- return structured compile/runtime status to the UI and grader;
- start from a fresh runtime context for each execution.

Changes to C/C++, JavaScript or TypeScript execution should include focused runtime tests and, when behavior is visible in the product, Playwright coverage.

### Curriculum changes

Curriculum content lives under `content/`.

When adding or editing courses, lessons or exercises:

- keep IDs stable once published;
- ensure course and exercise languages match;
- keep unlock order valid within each language;
- run `bun run content:validate`;
- prefer exercises that test the concept rather than one exact implementation.

### AI tutor and grader

Student-controlled text — including code, comments, stdin/stdout/stderr and chat messages — must remain untrusted input.

Do not make the tutor or grader depend on instructions embedded in student code. Trusted exercise/lesson specifications and system instructions must stay clearly separated from student-controlled content.

The tutor should remain read-only unless a future design explicitly changes that security boundary.

### Persistence and authentication

Every user-owned query or mutation must be scoped to the authenticated user. Avoid fetching a record by ID alone when ownership can be checked in the same query.

Do not commit credentials, production URLs that reveal private infrastructure, database files or `.env` files.

## Pull requests

A good PR should explain:

1. what changed;
2. why the change is useful;
3. important design decisions or limitations;
4. what was tested.

Small, focused PRs are easier to review than unrelated batches of changes.

## Reporting bugs

Please include reproduction steps, browser/runtime information and, when relevant, the language/runtime involved.

For security issues, do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).
