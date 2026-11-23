# Architecture — service-navigational-list

Source inspected: `1321893` plus local maintenance changes on 2026-11-22.

## Ownership

Navigation menu hierarchy, sorting and state. MenuController already delegates
domain behavior; it retains routing, Swagger/auth metadata and exact transport
Boolean parsing. No DTO, route, access policy or persisted schema changed.

## Source map

- `src/app.module.ts`
- `src/main.ts`
- `src/menu`
- `src/menu/menu-ordering.service.ts`
- `src/observability`
- `src/swagger.ts`

`src/app.module.ts` composes global ConfigModule, the Mongo connection, MenuModule
and ObservabilityModule. MenuModule imports the auth-client and its own
MenuItemDoc model, and registers the existing global authentication/role guards.
Both menu providers are private; there are no local consumers requiring exports.

MenuController -> MenuService -> MenuOrderingService is acyclic. Both services
inject the same module-owned model. MenuService owns CRUD, filters, archive state
and document-preserving hierarchy grouping. MenuOrderingService owns sibling
filters, old-parent gap closure, target ordering and final parent/position update.
It preserves sequential nontransactional writes, strict parent comparison,
root absent/null matching and explicit parent unsetting. There is no new
transaction, identifier conversion or archive exclusion in sibling filtering.

OpenAPI generation mode skips Mongo and retains existing model/auth stubs.
`src/observability/` provides structured HTTP logging and heartbeat support;
[observability.md](observability.md) records the collector contract and limits.

## External boundaries

Use installed dependencies in `package.json` and actual source imports as the
baseline for HTTP clients, auth and persistence. Inspect source, DTOs and existing
specs for current access/error policy. `test/`, when present, contains integration
configuration; generated artifacts are outputs, not the contract source.

See the source-backed [maintenance audit](../specs/001-code-maintenance/audit.md)
for priorities, characterization, checks and residual baseline failures. Remote
authentication remains owned by the installed auth-client; no foreign collection
access or speculative adapter was introduced. This maintenance is not a security
audit or evidence of live Mongo/auth/Grafana integration.

Generated deployment orchestration is centrally managed by the Node CLI; see [deployment-workflows](deployment-workflows.md).
