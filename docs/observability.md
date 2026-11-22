# Service logging and heartbeat

This service uses native NestJS 11 `ConsoleLogger` JSON output to stdout/stderr, with `Logger` context for application events. No Angular logger or application-held Grafana credential is used. HTTP logs contain generated request ID, method, route template, status and duration; bodies, cookies, authorization headers, concrete identifiers and query strings are not logged by the middleware. Health polling is excluded from access logs. Avoid embedding secrets or personal search text in domain log messages.

`GET /health` and HEAD return the anonymous operational Terminus heartbeat with `status: ok` and `heartbeat: up`, plus `Cache-Control: no-store`. This is liveness only; it does not claim MongoDB or upstream readiness. Existing business-route authentication remains enforced. The gateway's exact read-only heartbeat is the only exception to its normalized proxy-envelope requirement. The operational endpoint is excluded from business Swagger/contracts where that service generates them.

Docker probes `/health` every 30 seconds. Deployments bound each container's local JSON log files to 10 MiB × 3. Host Alloy discovers active service names and ships logs and private HTTP heartbeat probe metrics to Grafana Cloud stack `ivorytoffee195`. Collector configuration/dashboard lives in infrastructure owner `nginx-ngx-workshop.io/ops/grafana`; its ingestion token remains host-owned, scoped to logs/metrics write, and requires account authorization before activation. No production credential belongs in this repository.

Validation on 2026-11-21: the isolated observability HTTP suite passed (5 scenarios), build passed, Linux-targeted lockfile dry run passed. Guarded services additionally passed the anonymous-heartbeat/protected-business-route HTTP test. Gateway production ingress e2e passed (51 scenarios), including exact-path/method heartbeat boundaries. Gateway and publisher lint passed. Full existing unit suites passed except Backstage's unchanged Octokit ESM test-loader failure, reproduced on its pre-change HEAD. Uploader tests pass under its documented `npm test` command; its 10 optional cases remain skipped. Publisher persistence e2e cases require the isolated Mongo URI and remain skipped when unavailable. These are local checks, not evidence of Grafana ingestion or live deployment.

Live rollout correction (2026-11-21): health is explicitly public through the auth-client AuthType.None decorator where global authentication guards apply. The BFF legacy text /health handler is removed so only the Terminus JSON route owns that path. Regression HTTP tests include real authentication/role guards or the actual BFF controller.

## Menu domain events (maintenance, 2026-11-22)

MenuService emits one stable write outcome event: `menu.create`, `menu.update`,
`menu.remove` or `menu.reorder`. Archive/unarchive use `menu.update` once rather
than nesting duplicate domain events. Successful operations use log; expected
HTTP failures (e.g. conflict/not-found) use warn, storage/unexpected failures use
error. Each has outcome, nonnegative durationMs and generated UUID operationId.
Failures include only numeric statusCode, never raw error text/stack/DTOs.
Removed reorder payload/sibling debug logs. There is no per-item or read polling
event. HTTP access records remain separate transport summaries.

The existing middleware now scopes its generated requestId via AsyncLocalStorage,
so domain events after asynchronous work correlate to the response X-Request-ID.
Incoming IDs are deliberately ignored (including oversized/malicious values),
not echoed or trusted. Concurrent request contexts are isolated. Work outside
HTTP has operationId only; no cross-service propagation, background scheduler,
trace/span protocol or new readiness claim is introduced. GET/HEAD health remain
quiet. Unhandled framework errors retain pre-existing framework behavior; domain
event redaction is not a claim that every third-party logger has been audited.

Native Nest JSON places structured fields under `message`, not at top level:

```json
{
  "level": "log",
  "context": "MenuService",
  "message": {
    "event": "menu.reorder",
    "outcome": "success",
    "operationId": "00000000-0000-4000-8000-000000000001",
    "requestId": "00000000-0000-4000-8000-000000000002",
    "durationMs": 3
  }
}
```

Local native-output tests confirm this nesting. With the existing collector's
service label (substitute the deployed label selector), useful LogQL is:

```text
{service_name="service-navigational-list"}
  | json event="message.event", outcome="message.outcome", requestId="message.requestId"
  | event="menu.reorder"
```

Filter `outcome="failure"` for failed writes. Request/operation IDs are query
fields, not Loki labels (avoid high cardinality). The collector configuration,
actual label names and live Grafana receipt were not changed or verified here.
Local tests cover success/failure JSON, redaction canaries, original error identity,
concurrency, correlation and quiet health. Infrastructure owner must check live
Alloy ingestion after an authorized rollout; no app-held Grafana token was added.
