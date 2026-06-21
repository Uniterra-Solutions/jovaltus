# CI Conventions

## Validation Runs Before Packaging

The CI workflow orders steps as checkout, dependency install, lint, typecheck, test, build, package, then artifact upload. None of the post-validation steps use `if: always()` or `continue-on-error`, so a failure in any validation step stops the workflow.

**理由**: Running package and upload only after all checks pass prevents broken artifacts from being published.

**範例**: `.github/workflows/ci.yml:26-49` lists the steps in dependency order without unconditional continuation.

## Lockfile is Frozen in CI

Dependency installation in CI uses `pnpm install --frozen-lockfile`. This guarantees that CI uses the exact dependency graph recorded in the committed lockfile.

**理由**: Frozen installs make CI reproducible and surface lockfile drift immediately.

**範例**: `.github/workflows/ci.yml:27` runs `pnpm install --frozen-lockfile`.

## Missing Artifact Fails the Build

The artifact upload step targets `dist/*.vsix` and sets `if-no-files-found: error`. If packaging fails or produces no VSIX, the workflow fails rather than silently skipping upload.

**理由**: Explicit failure on missing artifacts ensures packaging regressions are caught at merge time.

**範例**: `.github/workflows/ci.yml:44-49` configures `actions/upload-artifact@v4` with `if-no-files-found: error`.
