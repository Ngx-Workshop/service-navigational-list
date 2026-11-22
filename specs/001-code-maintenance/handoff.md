# Handoff: Code Maintenance

Status: Implemented; locally verified with release/integration blockers
Updated: 2026-11-22
[Spec](spec.md) · [Plan](plan.md) · [Tasks](tasks.md) · [Audit](audit.md)

## Delivered

- Controller inspected and retained: already delegates business work. Private
  MenuOrderingService now owns sibling reorder sequencing; MenuService keeps
  CRUD, typed filtering and original-document hierarchy. Unused module export
  removed; guards, DTOs, persisted schema and error responses preserved.
- Pinned Husky/lint-staged, lockfile, guarded manifest prepare, staged Prettier
  and generated-output ignores. Non-mutating format/lint scripts and PR/reusable
  validation workflow; existing publishing now depends on validation.
- Safe menu write outcome events through existing native JSON logging.
  Generated operation/request IDs, AsyncLocalStorage isolation, no payload/raw
  error logging. HTTP logging and quiet GET/HEAD heartbeat preserved.
- Context docs and all T001–T010 local evidence updated. Initial unrelated
  untracked setup records preserved. No commits, pushes, publications or deployment.

## Evidence

| Check | Actual result |
| --- | --- |
| Pre-refactor menu characterization | 10 cases passed |
| `npm test -- --runInBand` | 3 suites, 20 cases passed |
| `npm run build` | Passed; includes OpenAPI generation |
| Generated OpenAPI comparison | Byte-identical to saved pre-refactor source baseline |
| `npm run format:check` | Passed, non-mutating |
| ESLint on changed services/middleware/tests | Passed |
| `npm run lint:check` | 14 pre-existing errors, 1 warning (baseline 52/9) |
| `npm run test:tooling` | 5 native test records passed, 4 install/hook scenarios |
| `git diff --check` | Passed |

Tooling fixtures exercise actual developer installation and real commits,
partial staging, untouched untracked content, failing-hook index restoration,
negative/positive non-mutating formatting, CI/HUSKY=0 opt-outs with Git,
CI no-Git install, Docker-style package-only install and production omit-dev
install with Git/hook present. These run on local Node 24.9.0/npm 11.6.0, not in
Linux containers or GitHub Actions.

The tracked OpenAPI artifact already differed from its source before extraction
(role enum metadata/route ordering). Generation was compared against freshly
generated baseline, then the tracked artifact restored to avoid unrelated drift.
No API definition change means no contract-package generation/publication needed.

## Blockers and exact next actions

1. **Repository maintainers:** address remaining baseline lint errors in
   app.module.ts, main.ts, menu.module.ts OpenAPI stubs, menu-item.schema.ts and
   swagger.ts as a separately scoped cleanup. The new lint gate intentionally
   blocks publishing/deployment until `npm run lint:check` passes.
2. **Repository test owners:** replace/repair the stale DB-initializing scaffold
   e2e (`GET /` expects absent Hello World and lacks app teardown). Its baseline
   failed and required stopping after 120 seconds. Isolated menu HTTP tests here
   use real auth/role guards with a remote-auth double and no live database.
3. **Build/infrastructure owners:** run the Node 22.23.5/Linux image check when
   Docker daemon is available. Local Docker info returned no server information.
   Production omit-dev install is only lifecycle evidence: the existing auth-client
   is a runtime import in devDependencies, and current Docker installs devDeps.
   Resolve that ownership separately before claiming an omit-dev runtime image.
4. **Infrastructure owner (`nginx-ngx-workshop.io`):** after release gates pass and
   deployment is separately authorized, verify Alloy discovery, actual Loki
   labels, JSON field queries and live Grafana receipt. Follow existing host-owned
   credential handling; no app-held token/direct ingestion.

No live Mongo, upstream auth or Grafana was verified. Reordering retains the
original nontransactional concurrency/failure limitations. npm reports 56
dependency advisories; no broad audit fix/upgrade was applied.

## Next selected work

No new feature is selected automatically. Start with the explicit baseline lint
release blocker above when authorized; do not rerun completed T001–T010 or treat
local test doubles as deployment acceptance.
