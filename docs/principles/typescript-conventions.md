# TypeScript Conventions

## Strict Compilation is Enabled

The base TypeScript configuration enables a comprehensive strictness profile including `strict`, `noImplicitReturns`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax`.

**理由**: Strict flags catch nullability, exhaustiveness, and import-type errors at compile time, which is important for an extension host that runs inside another process.

**範例**: `tsconfig.base.json:2-30` lists the strict compiler options.

## Type Imports are Preferred

Imports used only as types must be declared with the `type` keyword. ESLint enforces `@typescript-eslint/consistent-type-imports` with `prefer: 'type-imports'`.

**理由**: Type-only imports are erased at compile time and make the runtime module graph explicit.

**範例**: `apps/extension/src/extension.ts:1` uses `import type { ExtensionContext } from 'vscode';`.

## Project References Drive Build Order

The root `tsconfig.json` uses project references to ensure `packages/core` is built before `apps/extension`. This mirrors the workspace dependency graph in TypeScript's incremental build.

**理由**: Project references give deterministic composite builds and enable incremental compilation across package boundaries.

**範例**: `tsconfig.json:3` references `./packages/core` before `./apps/extension`.
