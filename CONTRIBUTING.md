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
