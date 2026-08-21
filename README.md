# crap4ts

This document follows Simplified Technical English.

`crap4ts` calculates cyclomatic complexity and coverage-weighted CRAP scores for TypeScript and TSX functions. It reports risky functions without changing source files or tests.

## Install and build

The `crap4ts` CLI and library support Node.js 20.19 or later.

Mutation testing is contributor-only tooling. `npm run mutation` requires Node.js 22.18 or later in the Node.js 22 release line. It also supports Node.js 24.11 or later. It does not support Node.js 20. The package `devEngines` warning documents this source-workspace requirement without raising the runtime requirement for CLI and library consumers.

```sh
npm install
npm run build
```

Run the built executable directly during local development:

```sh
node dist/cli/main.js --help
```

You can also use `npm link` after the build to make the `crap4ts` command available on your current machine.

## Configure a project

Create `crap4ts.config.json` in the project directory. The CLI reads only that file and does not search parent directories.

```json
{
  "sourceRoots": ["src"],
  "coverageCommand": "npm run coverage",
  "coveragePath": "coverage/coverage-final.json",
  "coverageFormat": "istanbul",
  "coverageDirectory": "coverage"
}
```

`sourceRoots` lists project-relative source directories. Generated mode also needs `coverageCommand`, `coveragePath`, and `coverageFormat`.

`coverageDirectory` is optional. Set it only when the whole directory contains disposable coverage output. The CLI removes this directory before it generates coverage.

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

## CLI options

| Option | Meaning |
| --- | --- |
| `--source-root <path>` | Replace configured source roots. Repeat the option to add roots. |
| `--coverage-command <command>` | Replace the configured command for generated mode. |
| `--coverage <path>` | Replace the project-relative coverage artifact path. |
| `--coverage-format <format>` | Select `istanbul` or `lcov`. |
| `--coverage-directory <path>` | Name an explicit project-relative directory that generated mode may remove. |
| `--use-existing-coverage` | Read the current artifact without cleanup or command execution. |
| `--json` | Write one JSON object instead of the text table. |
| `--help` | Print usage information. |

Command-line values replace matching configuration values. Repeated `--source-root` values replace the complete configured list.

## Read the reports

Text output contains the function name, module, cyclomatic complexity, coverage percentage, and CRAP score. It rounds coverage and CRAP to one decimal place.

```text
CRAP Report
===========
Function                       Module                                CC    Cov%     CRAP
----------------------------------------------------------------------------------------
risk                           src/example                            3   50.0%      4.1
```

The report sorts numeric CRAP scores from highest to lowest. Source path and source position break ties. Entries with `N/A` scores come after numeric scores.

`N/A` means that the analyzer lacks coverage evidence for that function. It does not mean 0 percent coverage. Text mode writes the reason to stderr.

JSON mode keeps full numeric precision. Each entry exposes its source position through top-level `start` and `end` objects. The report also includes tool metadata, coverage metadata, and structured diagnostics. Stdout contains exactly one JSON object, so another program can parse it directly.

```sh
crap4ts --json
```

## Formula

The CRAP score uses cyclomatic complexity `C` and coverage percentage `p`:

```text
CRAP = C^2 * (1 - p / 100)^3 + C
```

Full coverage reduces the score to the function complexity. Lower coverage increases the penalty for complex functions.

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

LCOV input uses line hits. Coverage is ambiguous when any two functions in one source file share a tracked physical line, including sibling and nested functions. The report includes `LCOV_FUNCTION_LINE_OVERLAP` for every affected function. The shared line still counts once within each function measurement.

The analyzer reports `N/A` when no coverage file matches a source or no tracked location belongs to a function. The diagnostics identify unmatched paths and unused coverage records.

Cleanup accepts project-relative descendants only. The CLI rejects the project root, parent paths, absolute paths, and symbolic links that escape the project.

The first release supports `.ts` and `.tsx` files, Istanbul JSON, and LCOV. It has no score threshold, so high scores do not change the exit code.

Exit code 0 means analysis completed, even when diagnostics or `N/A` values exist. Exit code 1 means coverage generation, reading, parsing, mapping, or analysis failed. Exit code 2 means arguments or configuration are invalid.

## Agent skill

The repository root includes `SKILL.md` for coding agents. The skill explains setup, report modes, filters, output, and coverage mapping diagnostics.

The skill does not authorize an agent to edit tests or source files. Give that instruction separately when you want implementation work.

## Project checks

```sh
npm test
npm run build
npx tsc -p tsconfig.json --noEmit
npm run coverage
npm run self-check
npm run mutation
```

`npm run self-check` builds the package and runs `crap4ts` against this repository. Mutation testing covers the scorer, complexity code, and coverage adapters. Run mutation with Node.js 22.18 or later in Node.js 22, or Node.js 24.11 or later.
