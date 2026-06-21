# VS Code Extension Platform

## Extension Host Exists

**Given** a developer has cloned the repository and installed workspace dependencies
**When** the developer builds the workspace
**Then** a VS Code extension entrypoint is produced that satisfies the extension package metadata
**And** the extension package remains part of the monorepo validation flow

## Local Extension Development Host Launch

**Given** a developer wants to test the extension locally in VS Code
**When** the developer follows the README local development instructions
**Then** VS Code can launch an Extension Development Host for the extension package
**And** the documented workflow identifies the prerequisite install and build commands

## CI Validates the Extension Platform

**Given** a change is pushed to the repository or proposed for merge
**When** GitHub Actions runs for the change
**Then** the workflow installs dependencies and runs repository validation checks for build, typecheck, lint, and tests
**And** failures in those checks prevent the workflow from being considered successful

## CI Publishes a VSIX Artifact

**Given** the repository validation checks pass in GitHub Actions
**When** the packaging step runs
**Then** a `.vsix` file for the Jovaltus VS Code extension is generated
**And** the workflow uploads that `.vsix` as a downloadable GitHub Actions artifact
**And** the artifact can be distinguished from generic build output by name and file extension

## README Includes Development and Packaging Commands

**Given** a contributor reads the repository README
**When** they look for extension development and packaging guidance
**Then** the README lists the commands needed to install dependencies, validate the workspace, build the extension, and create a VSIX package
**And** the README states the extension package location within the monorepo

---

## Source Evidence

- Extension host metadata and build contract: `apps/extension/package.json`
- Extension entrypoint implementation: `apps/extension/src/extension.ts`
- Root workspace validation scripts: `package.json`
- CI validation and artifact upload: `.github/workflows/ci.yml`
- Local launch and packaging guidance: `README.md`
