# crap4ts

This document follows Simplified Technical English.

CRAP means Change Risk Anti-Pattern. The score combines cyclomatic complexity with measured test coverage to identify TypeScript and TSX functions that are risky to change.

Complex functions have more execution paths. Low coverage gives you less evidence that a change preserves behavior. A high CRAP score means that one or both risks need attention.

`crap4ts` reports these risks without changing source files or tests. It is an independent implementation inspired by Uncle Bob's [`crap4clj`](https://github.com/unclebob/crap4clj). It is not a port or an official TypeScript version of `crap4clj`.

## Why CRAP scores matter for AI agents

Prompt instructions can lose influence as an agent's context grows. A deterministic check applies the same rule each time the workflow runs it.

Tools such as CRAP scoring and mutation testing can enforce measurable quality requirements without relying on the agent to remember them. `crap4ts` provides CRAP scoring. It does not provide mutation testing.

A workflow can rerun `crap4ts` after each change. The agent must then respond to current code and coverage data. It can add focused tests, reduce complexity, or explain why a function needs an exception.

A low score does not prove that the system has good names, module boundaries, or architecture. Use CRAP scoring as one quality check, not as a complete definition of maintainable code.

## Quick start

The CLI requires Node.js 20.19 or later.

Install from npm. No registry login is required to install this public package.

Install the CLI globally:

```sh
npm install --global @icaruswings138/crap4ts
```

Or install it as a development dependency in the project that you want to analyze:

```sh
npm install --save-dev @icaruswings138/crap4ts
npx crap4ts --help
```

The examples below use the global `crap4ts` command. For a local installation, use `npx crap4ts` or run `crap4ts` from a package script.

Run the remaining commands from the project that you want to analyze. Create `crap4ts.config.json` in that project root:

```json
{
  "sourceRoots": ["src"],
  "coverageCommand": "pnpm coverage",
  "coveragePath": "coverage/coverage-final.json",
  "coverageFormat": "istanbul",
  "coverageDirectory": "coverage"
}
```

Run the configured coverage command by itself first. Confirm that it creates the declared artifact:

```sh
pnpm coverage
```

Then generate a fresh report:

```sh
crap4ts
```

The report lists the highest CRAP scores first.

## Understand the score

The score uses cyclomatic complexity `C` and coverage percentage `p`:

```text
CRAP = C^2 * (1 - p / 100)^3 + C
```

Full coverage removes the coverage penalty, so the score equals the function's complexity. Low coverage increases the penalty for complex functions.

| Complexity | Coverage | CRAP |
| ---: | ---: | ---: |
| 2 | 0% | 6 |
| 5 | 0% | 30 |
| 10 | 50% | 22.5 |
| 10 | 100% | 10 |

A high score gives you two possible responses. Add focused tests when behavior lacks coverage. Simplify control flow when complexity drives the score. Some functions need both changes.

Use [Uncle Bob's published bands](https://github.com/unclebob/crap4clj#crap-formula) as guidance:

| CRAP score | Interpretation |
| --- | --- |
| 1-5 | Low. The function is simple or well covered. |
| 5-30 | Moderate. Consider focused tests or refactoring. |
| 30+ | High. The function is complex and under-tested. |

The published bands overlap at 5 and 30. Treat them as approximate guidance. Use an explicit `threshold` to enforce a maximum acceptable score.

## Recommended workflow

Use this loop before or during work on a risky module:

1. Run a baseline report.
2. Resolve `N/A` entries and coverage diagnostics before trusting the scores.
3. Filter the report to the module that you plan to change.
4. Start with the highest-scoring function in that module.
5. Add characterization tests when existing tests do not establish current behavior.
6. Reduce complex branching when complexity drives the score.
7. Run the project tests and `crap4ts` again.
8. Continue until the result meets the project's agreed limit.

The agent skill reports by default. Give the agent a separate instruction when you want it to edit tests or source files.

## Common CLI commands

Generate fresh coverage and analyze all configured source roots:

```sh
crap4ts
```

Filter the report to matching source paths:

```sh
crap4ts orders billing
```

Analyze an existing LCOV artifact:

```sh
crap4ts --use-existing-coverage \
  --coverage coverage/lcov.info \
  --coverage-format lcov
```

Analyze an existing Istanbul artifact:

```sh
crap4ts --use-existing-coverage \
  --coverage coverage/coverage-final.json \
  --coverage-format istanbul
```

Write structured output for an agent or another program:

```sh
crap4ts --json
```

## Configure a project

The CLI reads `crap4ts.config.json` from the current project directory. It does not search parent directories.

| Field | Required | Meaning |
| --- | --- | --- |
| `sourceRoots` | Yes | Project-relative TypeScript source directories. |
| `exclude` | No | Array of project-relative source exclusion globs. Defaults to `[]`. |
| `threshold` | No | Maximum acceptable CRAP score per function. A finite, non-negative number; omitted by default. |
| `coverageCommand` | Generated mode | Command that creates the coverage artifact. |
| `coveragePath` | Yes | Project-relative Istanbul or LCOV artifact path. |
| `coverageFormat` | Yes | `istanbul` or `lcov`. |
| `coverageDirectory` | No | Disposable directory that generated mode may remove. |

Set `coverageDirectory` only when the complete directory contains disposable coverage output.

## Generate and analyze coverage

Generated mode is the default. The CLI removes the configured artifact, runs the project coverage command, and analyzes the new artifact.

```sh
crap4ts
```

In text mode, the coverage command inherits the terminal input and output streams. In JSON mode, the CLI routes coverage stdout to stderr so report stdout stays parseable.

A failed coverage command stops the analysis with exit code 1.

The CLI does not guess a test runner, command, path, or format. Run the project coverage command yourself when the setup fails. Confirm that it creates the configured artifact.

## Analyze existing coverage

Use `--use-existing-coverage` to skip cleanup and command execution.

For LCOV line coverage:

```sh
crap4ts --use-existing-coverage \
  --coverage coverage/lcov.info \
  --coverage-format lcov
```

For Istanbul statement coverage:

```sh
crap4ts --use-existing-coverage \
  --coverage coverage/coverage-final.json \
  --coverage-format istanbul
```

The command reads the selected artifact as UTF-8 and leaves it unchanged.

## Filter source paths

Positional values filter project-relative source paths by substring. Multiple filters use OR matching.

```sh
crap4ts orders billing
```

This command includes a source path when it contains `orders` or `billing`.

## Exclude test files and generated code

Add `exclude` to `crap4ts.config.json` to omit files from source analysis:

```json
{
  "sourceRoots": ["src"],
  "exclude": [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
    "src/generated/**"
  ],
  "coverageCommand": "pnpm coverage",
  "coveragePath": "coverage/coverage-final.json",
  "coverageFormat": "istanbul"
}
```

Patterns match the complete project-relative path, using `/` separators on every operating system. Use `*` within a path segment, `**` across directories, `?` for one character, `[ab]` for character classes, and braces for alternatives such as `**/*.{test,spec}.{ts,tsx}`. Patterns also match dot files and dot directories. Absolute paths, parent (`..`) segments, backslash separators, and leading `!` negation are rejected. Use `directory/**` to exclude a directory's contents.

Add temporary exclusions with a repeatable CLI option. Quote each glob so the shell passes it unchanged:

```sh
crap4ts --exclude '**/*.test.ts' --exclude '**/__tests__/**'
```

CLI exclusions append to configured exclusions. A file must pass the source-root and positional-filter selection, then match none of the exclusion patterns. With no exclusions, test files remain eligible for analysis. If no files remain, the CLI reports the roots, filters, and exclusions and exits with code 2.

Exclusions affect source analysis, not the coverage command or which tests execute. Coverage records whose project-relative paths match an exclusion do not produce `UNMATCHED_COVERAGE_FILE` diagnostics. Other unmatched records are still reported. Source discovery still traverses the configured roots, so exclusions do not bypass directory permission errors.

Library callers can pass `exclude` in `analyzeProject` options, or as the optional fourth argument to `findSourceFiles`.

## Fail on high CRAP scores

Set an inclusive maximum with `--threshold`:

```sh
crap4ts --threshold 5
```

A score of 5 passes; 5.1 or 6 fails. The comparison uses the full, unrounded score, so 5.01 also fails even if the text table displays 5.0. Scores belong to individual functions: any function above the limit in any analyzed file fails the run.

To persist the limit, add `"threshold": 5` to `crap4ts.config.json`. The CLI option overrides the configured value. Without either setting, the run remains report-only.

The complete report is printed before the command exits with code 3 for a threshold breach. Each offending function produces a `CRAP_THRESHOLD_EXCEEDED` diagnostic with its source location, score, and threshold. Text diagnostics go to stderr; JSON diagnostics remain inside the report so stdout stays parseable.

The check applies only to functions selected by source roots, filters, and exclusions. It works with generated or existing coverage. `N/A` scores do not breach the threshold; their existing coverage diagnostics remain visible. A passing threshold check therefore does not guarantee complete coverage evidence.

## CLI options

| Option | Meaning |
| --- | --- |
| `--source-root <path>` | Replace configured source roots. Repeat the option to add roots. |
| `--exclude <glob>` | Append a source exclusion glob. Repeat to add more. |
| `--threshold <number>` | Fail with exit code 3 when any function's CRAP score is greater than this limit. |
| `--coverage-command <command>` | Replace the configured command for generated mode. |
| `--coverage <path>` | Replace the project-relative coverage artifact path. |
| `--coverage-format <format>` | Select `istanbul` or `lcov`. |
| `--coverage-directory <path>` | Name an explicit project-relative directory that generated mode may remove. |
| `--use-existing-coverage` | Read the current artifact without cleanup or command execution. |
| `--json` | Write one JSON object instead of the text table. |
| `--no-color` | Disable colours in the CRAP report. |
| `--help` | Print usage information. |

Except for additive `--exclude` patterns, command-line values replace matching configuration values. Repeated `--source-root` values replace the complete configured list.

## Read the reports

Text output uses a table with function, module, cyclomatic complexity, coverage, and CRAP columns. Numbers are right-aligned, with coverage and CRAP rounded to one decimal place. A summary counts analyzed functions, high-risk functions (CRAP >30), and functions missing coverage.

```text
CRAP Report
===========
+------------+------------+----+----------+------+
| Function   | Module     | CC | Coverage | CRAP |
+------------+------------+----+----------+------+
| placeOrder | src/orders | 12 |    45.0% | 36.0 |
| receipt    | src/orders |  2 |   100.0% |  2.0 |
+------------+------------+----+----------+------+

Functions: 2
High risk (>30): 1
Missing coverage: 0
```

Interactive terminals colour numeric cells using these display bands:

| Metric | Green | Yellow | Red |
| --- | --- | --- | --- |
| CRAP | ≤5 | >5 to 30 | >30 |
| Coverage | ≥80% | 50% to <80% | <50% |

`N/A` is grey. Colours and summary counts use the unrounded values. These bands are visual guidance; they do not enforce thresholds or affect exit codes. Complexity values are not colour-coded.

The table adapts to the terminal width and marks truncated names or modules with `…`. Terminals narrower than 60 columns use wrapped, labelled records; the minimum layout width is 20 columns. Redirected output and default library output are plain text with full names. JSON retains full names and values in every environment.

Use `--no-color`, set `NO_COLOR` (including an empty value), or use `TERM=dumb` to disable report colour. Redirecting stdout also disables colour automatically. These settings affect this report; the project's coverage command controls its own output.

```sh
crap4ts --no-color
crap4ts --json > report.json
```

Library callers can pass `{ color: true, columns: 80 }` as the second argument to `formatTextReport`. Without options, its output is deterministic, uncoloured, and not width-limited.

The report sorts numeric CRAP scores from highest to lowest. Source path and source position break ties. Entries with `N/A` scores come after numeric scores.

`N/A` means that the analyzer lacks coverage evidence for that function. It does not mean 0 percent coverage. Text mode writes the reason to stderr.

JSON mode keeps full numeric precision. Each entry exposes its source position through top-level `start` and `end` objects. The report also includes tool metadata, coverage metadata, and structured diagnostics. Stdout contains exactly one JSON object, so another program can parse it directly.

```sh
crap4ts --json
```

## Counted syntax

Every function starts at complexity 1. The analyzer adds 1 for each of these decisions inside that function:

- `if`
- conditional expressions with `? :`
- `for`, `for...in`, and `for...of`
- `while` and `do...while`
- `catch`
- each non-default `case`
- `&&`, `||`, and `??`

The analyzer does not add complexity for `else`, `default`, `try`, `finally`, optional chaining, or default parameters. A nested function has its own score, so its decisions do not increase the parent function score.

The extractor recognizes function declarations, function expressions, arrow functions, methods, constructors, accessors, class field functions, and TSX arrow components. It ignores declarations without an executable body.

## Coverage mapping and limitations

Istanbul input uses statement locations and statement counters. The analyzer does not replace missing statement data with function or branch counters.

LCOV input uses line hits. Coverage is ambiguous when any two functions in one source file share a tracked physical line, including sibling and nested functions. The report retains the stable `LCOV_NESTED_LINE_OVERLAP` code for every affected function. The shared line still counts once within each function measurement.

The analyzer reports `N/A` when no coverage file matches a source or no tracked location belongs to a function. The diagnostics identify unmatched paths and unused coverage records.

Cleanup accepts project-relative descendants only. The CLI rejects the project root, parent paths, absolute paths, and symbolic links that escape the project.

The analyzer supports `.ts` and `.tsx` files, Istanbul JSON, and LCOV. High scores change the exit code only when a threshold is configured.

Exit code 0 means analysis completed without a threshold breach, even when coverage diagnostics or `N/A` values exist. Exit code 1 means coverage generation, reading, parsing, mapping, or analysis failed. Exit code 2 means arguments or configuration are invalid. Exit code 3 means at least one function's CRAP score exceeded the configured threshold.

## Install the agent skill

The repository includes an Agent Skills-compatible `SKILL.md`. The skill teaches agents how to configure the project, run the CLI, interpret diagnostics, and report risky functions.

Install the CLI first. The skill does not provide the `crap4ts` executable.

From the `crap4ts` checkout, link the skill into your local agent directories:

```sh
scripts/link-skill.sh
```

The script creates these links:

- `~/.agents/skills/crap4ts` for Codex and compatible agents
- `~/.claude/skills/crap4ts` for Claude Code

The script refuses to replace a real directory at either path. A later `git pull` updates the linked skill. Rebuild the package when the CLI implementation changes.

Ask for a report without edits:

```text
Set up and run a CRAP report for this project. Do not edit tests or source files.
```

Authorize changes separately:

```text
Work through the highest CRAP scores in src/orders. Preserve behavior, run the tests, and rerun crap4ts after each change.
```

## Project checks

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, quality requirements, and pull request guidance.

Run the normal verification before a push:

```sh
pnpm verify
```

This command runs the complete test suite, builds the package, generates coverage, and prints this repository's CRAP report.

Run mutation testing as part of the slower full verification:

```sh
pnpm verify:full
```

You can also run each check separately:

```sh
pnpm test
pnpm build
pnpm exec tsc -p tsconfig.json --noEmit
pnpm coverage
pnpm self-check
pnpm mutation
```

`pnpm self-check` builds the package and runs `crap4ts` against this repository. Mutation testing covers the scorer, complexity code, and coverage adapters. Run `pnpm verify:full` with Node.js 22.18 or later in Node.js 22, or Node.js 24.11 or later.

## License

`crap4ts` is available under the [MIT License](LICENSE).
