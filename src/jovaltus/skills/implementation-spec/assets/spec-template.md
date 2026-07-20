# Spec: {{Task Name}}

> **PRD:** `.plan/{{DD-MM-YYYY}}/{{name}}/prd.md`
> **Design:** `.plan/{{DD-MM-YYYY}}/{{name}}/design.md`
> **Depends on:** {{spec filenames this task requires, or "None"}}

## Objective

{{One sentence: what this task delivers and why.}}

## Stack

- **Language:** {{e.g. Python 3.12}}
- **Framework:** {{e.g. FastAPI 0.115}}
- **Database:** {{e.g. PostgreSQL 16, SQLAlchemy 2.0}}
- **Key deps:** {{e.g. bcrypt, pydantic, pytest}}

## Files

| Action | Path | Purpose |
|--------|------|---------|
| CREATE | {{path/to/new/file.py}} | {{what this file does}} |
| READ | {{path/to/existing/file.py}} | {{context-only, why the agent needs to read it}} |
| EDIT | {{path/to/existing/file.py}} | {{what to change and why}} |
| OFF LIMITS | {{path/to/protected/file.py}} | {{why it must not be touched}} |

## Execution Plan

1. {{Action 1 — concrete and verifiable}}
2. {{Action 2}}
3. {{Write tests for all acceptance criteria}}
4. {{Run verification command}}

## Data Shapes

### Request

```json
{{Real example request body}}
```

### Response (Success)

```json
{{Real example success response}}
```

### Response (Error)

```json
{{Real example error response}}
```

## Acceptance Criteria

- Given {{precondition}}, When {{action}}, Then {{observable result}}
- Given {{precondition}}, When {{action}}, Then {{observable result}}
- Given {{precondition}}, When {{action}}, Then {{observable result}}

## Boundaries

### Allowed

- {{Action the agent can take without asking}}
- {{...}}

### Needs Approval

- {{Action that requires human sign-off}}
- {{...}}

### Forbidden

- {{Hard boundary — must not cross}}
- {{...}}

## Edge Cases

- {{What happens when <boundary condition>? Expected behavior.}}
- {{...}}

## Verification

```bash
{{Exact command that produces pass/fail}}
```

## Out of Scope

- {{What this spec explicitly does NOT cover}}
- {{...}}

## Notes

- {{Context the implementing agent needs that doesn't fit above}}
