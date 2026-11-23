# Development — service-navigational-list

Baseline: `1321893` on 2026-11-22. Use `package-lock.json` and `npm ci`; inspect the
Dockerfile and CI for the supported Node runtime. Do not upgrade NestJS/Node as
an incidental maintenance change.

## Existing npm scripts

| Script                                        | Command                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `build`                                       | `nest build`                                                                                           |
| `format`                                      | `prettier --write "src/**/*.ts" "test/**/*.ts"`                                                        |
| `start`                                       | `nest start`                                                                                           |
| `start:dev`                                   | `nest start --watch`                                                                                   |
| `start:debug`                                 | `nest start --debug --watch`                                                                           |
| `start:prod`                                  | `node dist/main`                                                                                       |
| `lint`                                        | `eslint "{src,apps,libs,test}/**/*.ts" --fix`                                                          |
| `lint:check`                                  | Non-mutating ESLint over owned TypeScript                                                              |
| `format:check`                                | Non-mutating Prettier over owned TypeScript and maintenance tooling                                     |
| `test:tooling`                                | Disposable install/Git-hook/partial-staging/format-gate tests                                            |
| `test`                                        | `jest`                                                                                                 |
| `test:watch`                                  | `jest --watch`                                                                                         |
| `test:cov`                                    | `jest --coverage`                                                                                      |
| `test:debug`                                  | `node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand` |
| `test:e2e`                                    | `jest --config ./test/jest-e2e.json`                                                                   |
| `openapi`                                     | `node dist/swagger.js`                                                                                 |
| `postbuild`                                   | `node dist/swagger.js`                                                                                 |
| `contracts:service-navigational-list:gen`     | `npm --prefix ./contracts/service-navigational-list run gen`                                           |
| `contracts:service-navigational-list:build`   | `npm --prefix ./contracts/service-navigational-list run build`                                         |
| `contracts:service-navigational-list:publish` | `npm --prefix ./contracts/service-navigational-list publish --access public`                           |

`lint` and `format` mutate files; use `lint:check` and `format:check` to verify.
Prettier style is unchanged. Pinned Husky/lint-staged format only staged supported
TS/JS/JSON/YAML files; lint-staged's default stash preserves partial staging and
unstaged changes. Syntax/tool failures block commits. Generated contracts,
OpenAPI, lockfiles, build/coverage and historical documentation are ignored.
No network dependency installation occurs at commit time.

`npm ci` installs developer hooks using a manifest-contained prepare command.
Hook setup skips CI, HUSKY=0, production/omit-dev, missing Git, missing hook files
or missing Husky. Thus Docker's existing package-only install ordering requires
no new script copied into the image. The guarded lifecycle reports installer
errors rather than treating them as success. `npm run test:tooling` performs real
disposable installs and commits; it needs npm registry/cache access and Git.

The PR validation workflow is also called by deployment before publishing.
It runs install, non-mutating formatting, tests, OpenAPI-mode build and lint.
The lint gate currently **blocks publication/deployment** on 14 existing errors
and 1 warning outside the refactored behavior; see the
[audit](../specs/001-code-maintenance/audit.md) for paths. It does not weaken rules
or silently accept baseline debt.

## Runtime and verification

Inspect configuration reads in `src/`, Docker and workflow files for required
environment variables; never print or commit `.env` credentials. Use existing
local-development documentation and isolated data where available. Read
[observability.md](observability.md), existing security/deployment docs and previous
feature specs before touching runtime behavior.

Local maintenance verification: 20 unit/isolated HTTP cases, build, changed-behavior
ESLint, formatting and 5 tooling test records pass. Local Node was 24.9.0/npm 11.6.0;
Docker/CI's declared Node 22.23.5 was not executed locally. Docker daemon was
unavailable; package-only install checks are not image/runtime validation.

The existing `test:e2e` scaffold expects an absent Hello World route and does not
close its app; it failed before changes and was stopped after 120 seconds.
Prefer the isolated menu HTTP suite for this maintenance; do not load live
configuration/database merely to rerun that scaffold.

Production omit-dev installation passes the hook check but is not a supported
runtime claim: auth-client remains a pre-existing runtime import declared as a
devDependency. The current Dockerfile installs devDependencies. Live Mongo,
auth and Grafana checks remain external-owner work. Do not use production writes
as tests. See [handoff](../specs/001-code-maintenance/handoff.md) for next actions.

Deployment and npm publication now follow [deployment-workflows](deployment-workflows.md).
