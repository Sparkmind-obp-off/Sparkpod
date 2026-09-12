# Workspace & Execution Data Model

## Workspace

A logical user-owned container for executions, configuration and future project files.

Fields: `id`, `ownerId`, `name`, `createdAt`, `updatedAt`.

## Execution

Fields: `id`, `workspaceId`, `instruction`, `tool`, `provider`, `status`, `stage`, `createdAt`, `startedAt`, `finishedAt`, `resultRef`, `error`.

## Provider session

Store only the minimum provider identifier required for lifecycle operations. Encrypt or tightly restrict any sensitive provider metadata.

## Persistence principle

Do not introduce a database table merely because the architecture can support it. MVP persistence should be minimal and justified by a user-visible requirement.

## Retention

Execution output and audit data must have explicit retention rules. Disposable sandbox contents are not assumed to be permanent unless a future persistent workspace feature requires it.
