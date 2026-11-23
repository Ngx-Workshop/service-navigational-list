# Agent entry point — service-navigational-list

This repository owns navigation menu hierarchy, sorting and state. Work from this checkout; sibling source is
not required.

Read [.specify/memory/constitution.md](.specify/memory/constitution.md),
[architecture](docs/architecture.md), [development](docs/development.md),
[workflow](.specify/README.md) and the [feature index](specs/README.md) before edits.

- Inspect source and git status; preserve unrelated work and historical specs.
- Keep feature spec, plan, tasks and handoff aligned; mark complete with evidence.
- Preserve public contracts and access policies. Generate contracts from source.
- Keep controllers thin, providers cohesive and module exports intentional.
- Use owner-service APIs; do not couple to another service's collections.
- Inspect filtering/projection logic in menu.controller.ts for extraction into cohesive services. Preserve hierarchy, sort, domain, structural-subtype and state behavior, including identifiers and archive semantics.
- Reuse existing structured logging; read [observability](docs/observability.md).
- Verify changed behavior and distinguish local tests from live integration.
- Resolve routine choices; ask only for consequential missing decisions.

This is a Spec Kit-inspired Markdown setup, not an installed Spec Kit CLI.

## Code Maintenance: implemented locally

The selected [Code Maintenance](specs/001-code-maintenance/spec.md) is implemented
and locally verified, with documented baseline/external limits.
Read its [plan](specs/001-code-maintenance/plan.md), [tasks](specs/001-code-maintenance/tasks.md) and
[handoff](specs/001-code-maintenance/handoff.md). T001–T010 have evidence; retain older unfinished
feature records without treating them as the next task. The requested work covers
NestJS module/domain boundaries, thin controllers, cohesive services, Prettier
with Husky/lint-staged, CI checks and safe domain logging through existing
observability. No new feature is selected automatically. Baseline lint failures
block the new CI release gate; follow handoff actions when authorized. Container
and live Grafana checks are pending external-owner verification.

Current deployment policy: [deployment-workflows](docs/deployment-workflows.md). Automatic main delivery verifies/deploys; npm publication is manual only. This supersedes older automatic-publishing instructions.
