# Environment & Secrets Contract

## Server-only variables

- `DAYTONA_API_KEY`
- `DAYTONA_API_URL`
- `DAYTONA_TARGET`
- `SPARKPOD_SESSION_SECRET`
- future provider credentials

## Public configuration

Only non-sensitive identifiers and feature flags may reach the browser.

## Environment policy

Local, preview and production values are separate. Production secrets are configured in Cloudflare, never committed to Git.

## Rotation

Provider credentials must be rotatable without source changes. Revocation/rotation must not require a client rebuild.

## Failure behavior

Missing configuration returns a safe `configuration` error. It must never dump environment variables or secret values.
