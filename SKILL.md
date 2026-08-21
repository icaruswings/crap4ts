---
name: crap4ts
description: Calculate cyclomatic complexity and coverage-weighted CRAP scores for TypeScript and TSX functions. Use for TypeScript CRAP reports, risky-function ranking, or CRAP coverage mapping problems. Do not use it as an autonomous refactoring workflow.
---

# crap4ts

Use `crap4ts` to rank TypeScript and TSX functions by cyclomatic complexity and test coverage.

## Set up a project

Inspect the project's source roots, test scripts, and existing coverage output. Add or update `crap4ts.config.json` only when the user asks for setup.

```json
{
  "sourceRoots": ["src"],
  "coverageCommand": "pnpm coverage",
  "coveragePath": "coverage/coverage-final.json",
  "coverageFormat": "istanbul",
  "coverageDirectory": "coverage"
}
```

Use the project's real coverage command and artifact path. Do not invent a test runner or coverage path.

## Run a report

Generated coverage mode removes the configured artifact, runs the configured command, and analyzes the new artifact.

```sh
crap4ts
```

Run the project's coverage command independently when setup fails. Check that the command creates the configured artifact in the declared format.

Use an existing LCOV artifact without running tests:

```sh
crap4ts --use-existing-coverage --coverage coverage/lcov.info --coverage-format lcov
```

Use an existing Istanbul artifact without running tests:

```sh
crap4ts --use-existing-coverage --coverage coverage/coverage-final.json --coverage-format istanbul
```

Add positional path filters to limit the report. Multiple filters use OR matching.

```sh
crap4ts orders billing
```

Add `--json` when exact scores, source ranges, or structured diagnostics matter.

## Read the result

The text report ranks numeric CRAP scores from highest to lowest. A high score combines complex control flow with low coverage.

Use Uncle Bob's published bands as guidance:

| CRAP score | Interpretation |
| --- | --- |
| 1-5 | Low. The function is clean. |
| 5-30 | Moderate. Consider adding tests or refactoring. |
| 30+ | High. The function is complex and under-tested. |

The published bands overlap at 5 and 30. Treat them as approximate risk guidance. They are not pass/fail thresholds and do not change the exit code. Do not refactor or add tests unless the user gives a separate instruction.

Treat `N/A` as missing evidence. It does not mean zero coverage or a low-risk function.

Text diagnostics go to stderr. JSON reports include diagnostics in the `diagnostics` array. Check these mapping conditions before interpreting a score:

- `NO_MATCHING_COVERAGE_FILE`: No coverage record matched the source path.
- `NO_TRACKED_COVERAGE`: The matched record had no usable location for the function.
- `LCOV_NESTED_LINE_OVERLAP`: LCOV could not separate functions that share a tracked physical line.
- `UNMATCHED_COVERAGE_FILE`: A coverage record did not match an analyzed source file.

Correct the configured roots, artifact format, or path when those values are wrong. Do not change tests or source code unless the user gives a separate instruction.
