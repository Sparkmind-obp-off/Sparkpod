# Cloudflare Runtime & Deployment

## Production role

Cloudflare is the primary application edge and deployment platform for SparkPod.

## Initial topology

```text
Browser
  ↓ HTTPS
Cloudflare Pages/Workers
  ↓
SparkPod API
  ↓
Orchestrator
  ↓ HTTPS/server-side secret
Daytona API
  ↓
Sandbox
```

## Rules

- All provider calls originate server-side.
- No Daytona API key in client bundles, D1, URLs, logs, or Git.
- Production secrets use Cloudflare encrypted secrets.
- CORS, CSRF/same-origin rules, authentication and authorization are explicit.
- Deployment must be reproducible from Git.
- Preview deployments must never silently use production credentials.

## Environment separation

`local`, `preview`, and `production` have independent secrets/configuration.

## Deployment gate

A deployment is successful only after build/typecheck/tests pass and the deployed endpoint reports the expected application version. Provider connectivity must then be tested against production configuration.
