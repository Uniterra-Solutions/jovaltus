# Technical Design — {{Project Name}}

> PRD: `.plan/{{DD-MM-YYYY}}/{{requirement-name}}/prd.md`

## 1. Architecture

### Overview

{{One paragraph describing the overall system shape: what runs where, how
components communicate, key architectural pattern (monolith, services, etc.).}}

### Architecture Diagram

```
{{ASCII or mermaid diagram showing components and their relationships}}
```

### Key Architectural Decisions

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| {{decision}} | {{why}} | {{alt 1}}, {{alt 2}} — rejected because {{reason}} |

## 2. Tech Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| {{layer}} | {{tech}} | {{version}} | {{one-sentence rationale}} |

## 3. Data Model

### Entity: {{Entity Name}}

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| {{col}} | {{type}} | {{NOT NULL, UNIQUE, etc.}} | {{what it holds}} |

### Indexes

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
| {{table}} | {{cols}} | {{BTREE, GIN, etc.}} | {{what query it serves}} |

### Relationships

- {{Entity A}} → {{Entity B}}: {{one-to-many, etc.}} via {{FK on column}}

### Migrations

{{Migration strategy: tool (Alembic, etc.), conventions, rollback approach}}

## 4. API Design

### Style

{{REST / GraphQL / gRPC}} — {{one-sentence rationale}}

### Endpoints

| Method | Path | Auth | Purpose | Request Body | Response |
|--------|------|------|---------|-------------|----------|
| {{GET}} | {{/api/resource}} | {{public/user/admin}} | {{what it does}} | {{key fields}} | {{key fields + status}} |

### Authentication

{{Mechanism: JWT, session, OAuth, API key. Token format. Refresh strategy.}}

### Rate Limiting

{{Approach: per-user, per-IP, sliding window. Limits.}}

## 5. Component / Module Breakdown

### {{Module Name}}

- **Responsibility:** {{single responsibility statement}}
- **Public Interface:** {{key functions, classes, or endpoints exposed}}
- **Depends on:** {{other modules it calls}}
- **Depended on by:** {{modules that call it}}

## 6. Data Flow

### {{Flow Name}}

```
{{Step-by-step trace of data through the system. Use ASCII art or mermaid.}}
```

## 7. Auth & Security

### Authentication

{{How users prove identity. Login flow. Session management.}}

### Authorization

{{Role/permission model. How access control is enforced.}}

### Security Measures

| Concern | Approach |
|---------|----------|
| Data in transit | {{TLS, etc.}} |
| Data at rest | {{encryption approach}} |
| Input validation | {{strategy}} |
| XSS/CSRF | {{prevention}} |
| Secrets | {{management approach}} |

## 8. Error Handling & Resilience

### Error Response Format

```json
{{Standard error response shape}}
```

### Resilience Patterns

| Pattern | Where | How |
|---------|-------|-----|
| Retry | {{component}} | {{strategy, max attempts, backoff}} |
| Circuit Breaker | {{component}} | {{thresholds}} |
| Graceful Degradation | {{scenario}} | {{what still works}} |

### Idempotency

{{Which operations are idempotent. How idempotency keys work.}}

## 9. Infrastructure & Operations

### Hosting

{{Platform, region, instance types.}}

### Containerization

{{Docker, orchestration, image strategy.}}

### CI/CD

{{Pipeline: build → test → deploy. Tools. Environments.}}

### Observability

| Pillar | Tool | What We Track |
|--------|------|---------------|
| Logging | {{tool}} | {{structured logging, levels}} |
| Metrics | {{tool}} | {{key metrics}} |
| Tracing | {{tool}} | {{distributed tracing approach}} |
| Alerting | {{tool}} | {{alert conditions}} |

### Backup & Recovery

{{Backup strategy. RPO. RTO. Restore procedure summary.}}

## 10. Non-functional Design

### Caching

| What | Where | TTL | Invalidation |
|------|-------|-----|-------------|
| {{data}} | {{cache layer}} | {{duration}} | {{when/how it's invalidated}} |

### Performance Targets

| Metric | Target | Measured By |
|--------|--------|-------------|
| {{p95 latency}} | {{ms}} | {{tool}} |
| {{throughput}} | {{rps}} | {{tool}} |

### Scaling

{{Horizontal/vertical. Auto-scaling triggers. Database scaling approach.}}

## Open Questions

- {{Question that needs a decision before implementation}}
- {{...}}
