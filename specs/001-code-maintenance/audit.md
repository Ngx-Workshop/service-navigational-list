# Maintenance audit

Inspected 2026-11-22, HEAD `1321893`, branch `main`. Initial worktree contains
untracked workflow/instruction/spec/context files; these are preserved and only
directly related maintenance records/entry points are updated. Repository-local
guidance was used; no sibling source checkout was inspected.

## T001 baseline

- Local Node `v24.9.0`, npm `11.6.0`; Docker/CI specify Node 22.23.5.
- `npm test -- --runInBand`: 6 tests pass (observability only).
- `npm run build`: passes, including OpenAPI generation. Subsequent diff inspection
  revealed pre-existing generated artifact drift: role `none`, role DTO enum
  metadata and route key ordering. Saved the freshly generated pre-refactor
  baseline, compared it byte-for-byte after extraction, then restored the tracked
  artifact to avoid bundling unrelated contract drift.
- `npx --no-install eslint "{src,apps,libs,test}/**/*.ts"`: 52 errors,
  9 warnings. Unsafe model/filter/hierarchy/error access dominates MenuService;
  other findings are async-without-await OpenAPI stubs/config factory, cookie
  parser typing, schema update typing and Swagger error typing.
- `npx --no-install prettier --check "src/**/*.ts" "test/**/*.ts"`: passes.
- `npm run test:e2e -- --runInBand`: existing scaffold expects `GET /` to return
  Hello World but receives 404. Missing teardown leaves handles open; stopped
  after 120 seconds. Do not rerun this DB-initializing scaffold as a live test.
  New HTTP characterization uses model doubles and real guards, without AppModule
  or configuration loading.

## T002 dependency/ownership map

- AppModule composes global ConfigModule, Mongo connection (5-second selection
  timeout), MenuModule and ObservabilityModule. OpenAPI mode excludes Mongo.
- MenuModule owns MenuController, MenuService and the MenuItemDoc model; imports
  NgxAuthClientModule and registers global AuthenticationGuard/RolesGuard.
  MenuService export has no local consumers. Remote authentication is the sole
  upstream boundary, owned by the installed auth-client, not menu persistence.
- MenuController owns routing, Swagger metadata and transport Boolean parsing.
  It already delegates filtering and hierarchy; no domain extraction from this
  controller is justified. GET routes are explicitly anonymous, writes Admin-only.
- MenuService owns CRUD, filters, hierarchy grouping and a separate multi-stage
  sibling reorder use case. Mongo schema owns indexes, defaults and version hook.
  No foreign collections, cycles, forwardRef or service locator found.
- ObservabilityModule owns Terminus liveness; native JSON logger and HTTP middleware
  exclude health, generate request IDs and omit raw request fields. Request ID is
  not yet available to async domain work.

## Prioritized findings and selected implementation

1. High: reorder debug calls serialize DTOs, identifiers and sibling lists.
   Remove these and use one safe outcome event per write operation with duration
   and generated operation/request IDs, never raw errors/content.
2. Medium: isolate sibling reordering in a private model-backed MenuOrderingService,
   keeping sequential writes, filters, root matching/unsetting and archive semantics
   unchanged. It must not depend back on MenuService. Remove unused MenuService
   export; retain global auth registrations and OpenAPI stubs.
3. Medium: replace service `any` filters/errors/hierarchy with proper guards and
   types. Keep original documents in hierarchy (no DTO conversion: ObjectIds,
   dates and serialization must remain unchanged).
4. Medium: install pinned Husky/lint-staged, manifest-contained guarded prepare,
   staged Prettier, explicit generated-output ignores and non-mutating CI gates.
   Source formatting baseline is already clean; gate owned TS and tooling only,
   not historical Markdown or generated contracts.
5. Out of scope: unrelated bootstrap/schema/Swagger lint errors and stale e2e
   scaffold. Report these instead of weakening lint or changing runtime/auth.

## Compatibility and constitution

Characterize filters, archive defaults, hierarchy document identity, reorder
positions/root/cross-parent behavior, duplicate/not-found/storage failures and
real HTTP validation/guards before extraction. Preserve DTOs/routes, schemas,
version hooks, original errors and nontransactional sequencing. Do not normalize
the existing ObjectId-vs-string parent comparison: that changes write behavior.
No API or contract-definition change is intended; compare generated OpenAPI.
All six constitution principles are satisfied by this bounded scope; no deviation.
Live Mongo/auth/Grafana and Linux container execution are not implied by local
model doubles or package-only installs. External infrastructure owns rollout.

## Implementation and final evidence

- T003: 10 characterization cases passed before refactor (service and real guarded
  HTTP boundary); expanded to cover final-update absence and parent-to-root moves.
- T004: private MenuOrderingService owns the original sequential reorder algorithm.
  CRUD/hierarchy remain cohesive in MenuService with typed filters and guarded
  duplicate-error mapping. No controller/DTO/schema changes. Mongoose fixtures
  expose string parent values; same-parent regression uses that actual behavior,
  not an assumed ObjectId representation. Strict comparison remains unchanged.
- T005/T006: pinned Husky 9.1.7 and lint-staged 16.2.7, lockfile, manifest-contained
  prepare, pre-commit, ignores and non-mutating scripts. `npm ci` succeeded locally.
  `npm run test:tooling`: 5 native test records pass (parent plus 4 scenarios):
  clean developer install, real commit formatting/partial staging/untracked edit
  preservation, syntax failure blocking commit/restoring index, negative
  non-mutating format gate followed by positive gate, CI/HUSKY=0 opt-out with Git,
  CI no-Git install, package-only no-Git install, production omit-dev install with
  Git/hook present. Fixtures remove their own temporary directories.
- T007/T008: bounded write outcome events and request AsyncLocalStorage, unchanged
  generated HTTP IDs and health exclusions. Success/failure JSON, error identity,
  conflict severity, canary omission and concurrent request isolation covered.
  Archive/unarchive reuse the update event, avoiding nested duplicate domain logs.
- T009: `npm test -- --runInBand`: 20 cases pass; `npm run build` passes;
  generated OpenAPI equals saved source baseline. `npm run format:check` passes.
  Targeted ESLint on changed services, middleware and tests passes.
  `npm run lint:check`: 14 pre-existing errors and 1 warning remain, down from
  52 errors/9 warnings; no rules weakened. Remaining paths: app.module.ts,
  main.ts, menu.module.ts OpenAPI stubs, menu-item.schema.ts, swagger.ts.
  `git diff --check` passes. No contract package generation/publication required.

## Limits and next-owner actions

- Validation runs on PRs and as a reusable prerequisite to the existing main-branch
  publishing/deployment workflow. The lint gate intentionally blocks release
  until the listed baseline errors are addressed in a separate scoped cleanup.
  No CI run, publication or deployment was initiated.
- Docker client exists, but `docker info --format '{{.ServerVersion}}'` failed
  with nil server information. Package-only installs are local Node 24 checks,
  not a Linux image build or proof of runtime startup on Node 22.
- Production omit-dev verifies only installation/hook lifecycle. The pre-existing
  auth-client is declared under devDependencies while imported at runtime; the
  existing Docker image installs devDependencies. Do not claim an omit-dev runtime
  image is supported without a separate dependency ownership correction.
- The stale DB-initializing scaffold e2e remains failed/unmodified. New tests
  use no live Mongo or remote auth service. Reorder retains nontransactional writes
  and its post-write read/failure semantics; no concurrency guarantee was added.
- npm reported 56 dependency advisories during installation; no unrequested audit
  fixes or dependency-wide upgrades were applied.
- Infrastructure owner must verify Node 22/Linux image build and then, after
  release gates pass and rollout is authorized, confirm Alloy/Grafana ingestion.
  App credentials/direct ingestion remain out of scope.
