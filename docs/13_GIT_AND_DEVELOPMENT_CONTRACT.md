# Git & Development Contract

## Branching

`main` is deployable. Feature work should use short-lived branches when changes are risky; small documentation changes may land directly when safe.

## Definition of done

A feature is not done because code exists. It requires tests, typecheck/build, security review where relevant, and an explicit acceptance result.

## Change discipline

Keep provider-specific code isolated. Avoid speculative dependencies. Do not copy large portions of vendor SDK internals into business logic.

## Commit messages

Use concise conventional messages such as `feat: add Daytona execution adapter` or `fix: normalize sandbox timeout`.

## Secret check

Before every deployment/commit, inspect changed files and generated output for credentials, tokens, cookies and private configuration.
