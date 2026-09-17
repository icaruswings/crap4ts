# Contributing to crap4ts

Thank you for contributing to `crap4ts`. Contributions should keep the scorer deterministic, predictable, and useful in automated workflows.

## Before you start

You can open a pull request for a small fix without an issue. Open an issue first for these changes:

- New command-line behavior
- Changes to the CRAP formula or counted syntax
- Changes to coverage attribution
- Changes that break text output, JSON output, or the library API

Normal development requires Node.js 20.19 or later. Mutation testing requires Node.js 22.18 or later, or Node.js 24.11 or later.

The repository uses pnpm 10.8.1. Corepack can activate the version from `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
```

## Make a change

- Add or update tests for each behavior change.
- Keep report entries and diagnostics in deterministic order.
- Keep every production function at cyclomatic complexity 5 or lower.
- Keep this repository's maximum CRAP score below 6.
- Update `README.md` and `SKILL.md` when user-facing behavior changes.
- Do not commit `dist`, coverage output, or Stryker temporary files.
- Do not remove or weaken a test only to improve a score.

Add tests for the formula and boundary values when you change scoring. Add fixtures for each new TypeScript syntax form that affects complexity.

Coverage changes need format-specific fixtures and mapping tests. Command-line changes must preserve documented exit codes and machine-readable JSON output.

## Run the checks

Run normal verification before you open a pull request:

```sh
pnpm verify
```

This command runs all tests, builds the package, generates coverage, and scores the repository.

Run full verification after changes to scoring, complexity, coverage, or mutation configuration:

```sh
pnpm verify:full
```

Full verification also runs the mutation test suite. The mutation score must meet the configured 80 percent threshold.

## Publish to npm

The package is published to npm as `@icaruswings138/crap4ts`. The executable remains `crap4ts`.

Keep the version in `package.json` and `src/version.ts` in sync for each release. Each published version must be unique on npm.

```sh
pnpm install --frozen-lockfile
pnpm verify
npm pack --dry-run
```

For the first npm release, log in with an account that can publish under `@icaruswings138`, then publish locally:

```sh
npm login --registry=https://registry.npmjs.org/
npm publish
```

After the first release, configure a GitHub Actions trusted publisher in the npm package settings:

- Organization or user: `icaruswings`
- Repository: `crap4ts`
- Workflow filename: `publish-package.yml`
- Environment: leave blank
- Allow direct publishing with `npm publish`

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for setup details. The workflow requires npm 11.5.1 or later, provided by the current Node.js 24 installation. No stored npm token is needed.

For later releases, push the version changes, then run **Publish npm Package** from the repository's Actions tab on `main`. The workflow also runs when a GitHub release is published. Release tags must match the package version, for example `v0.1.1`. Use one trigger per version.

The workflow installs locked dependencies, runs verification and type checks, and publishes using npm's trusted publishing connection. Configure that connection before triggering the workflow.

Packing and publishing run the build automatically. The package includes compiled JavaScript, type declarations, source maps, TypeScript sources, the agent skill, and documentation. Tests, coverage output, and local configuration are excluded. Public access and the npm registry are set in `package.json`.

## Open a pull request

Keep each pull request focused on one change. In the description, explain the reason, the user-visible behavior, and the commands that you ran.

Link any related issue. Include sample output when you change a report or diagnostic.

By contributing, you agree that the project can distribute your contribution under the [MIT License](LICENSE).

## Report a problem

A useful bug report includes:

- The exact command
- The relevant `crap4ts.config.json` values
- The Node.js and pnpm versions
- The coverage format
- The diagnostic code or error message
- A small reproduction, when possible

Remove credentials, private paths, and proprietary source code before you attach logs or coverage artifacts.
