# Coding Standards

## Runtime & Toolchain

- Node.js 26, ESM-only (`"type": "module"` in package.json)
- TypeScript executed via `node --experimental-strip-types` — no `tsx`, no build step
- File extensions: `.mts` for source, `.mjs` for plain JS
- Env vars loaded via `node --env-file=.env` — no `dotenv` package

## TypeScript

- `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride`
- No `any` — use `unknown` at boundaries, narrow explicitly
- No type assertions (`as Foo`) except where TypeScript cannot infer a narrowed type
- Prefer `type` over `interface` unless declaration merging is needed

## Style & Formatting

- Biome for linting and formatting — single source of truth, no Prettier, no ESLint
- Naming:
  - Files: `kebab-case.mts`
  - Variables, functions: `camelCase`
  - Types, classes: `PascalCase`
  - Module-level constants: `SCREAMING_SNAKE_CASE`
  - No `I`-prefix on interfaces
- Named exports only — no default exports
- Explicit `.mts` extensions in all local imports: `import { foo } from "./foo.mts"`
- `async/await` only — no `.then()/.catch()` chains except at `Promise.all*` callsites

## Architecture

- Source under `src/`, organized by feature (`src/users/`, `src/orders/`)
- No barrel `index.mts` re-exports — import directly from the file
- Custom error classes extending `Error` with `name` set; `throw` at boundaries, `catch` at entry points
- Zod validation at all trust boundaries: env vars (fail fast at startup), HTTP request bodies, external API responses
- No runtime validation inside the app — rely on TypeScript types

## Dependencies

- Runtime deps in `dependencies`, everything else in `devDependencies`
- Banned packages: `lodash` (use native methods), `moment`/`dayjs` (use `Temporal` API), `dotenv` (use `--env-file`)
- Before adding a dep: check if Node.js 26 stdlib covers it

## Testing

- Vitest for all tests
- Test files colocated with source: `src/users/user-service.test.mts`
- Test names describe expected behavior: `"returns 404 when user not found"`
- Cover happy path + error boundaries; no tests for trivial one-liners

## Comments

- Comments only for non-obvious WHY: hidden constraints, workarounds, subtle invariants
- Banned: JSDoc on internal functions, restatements of what code does, TODO/FIXME (use issues), commented-out code
