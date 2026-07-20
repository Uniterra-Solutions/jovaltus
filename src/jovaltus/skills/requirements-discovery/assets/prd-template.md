# {{Project Name}}

## Overview

{{One paragraph describing what this project is, who it's for, and the core problem it solves. No implementation details.}}

## Target Users

<!-- For each user type: -->

### {{User Type 1}}

{{Who they are. What they need from this system.}}

### {{User Type 2}}

{{...}}

## Core Features

### P0 — Must Have

#### {{Feature Name}}

{{What the user can do. Describe from user perspective — not implementation.
Include acceptance criteria: "The user can ..." }}

#### {{Feature Name}}

{{...}}

### P1 — Should Have

#### {{Feature Name}}

{{...}}

### P2 — Nice to Have

#### {{Feature Name}}

{{...}}

## Data Model

<!-- Remove this section if the system is stateless or has no persistent data. -->

### Entities

#### {{Entity Name}}

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| {{field}} | {{type}} | {{yes/no}} | {{description}} |

### Relationships

- {{Entity A}} has many {{Entity B}}
- {{...}}

## User Journeys

<!-- Key flows. Use numbered steps. -->

### {{Journey Name}}

1. {{Step 1}}
2. {{Step 2}}
3. {{...}}

## Non-functional Requirements

- **Performance:** {{Expected load, response time targets}}
- **Security:** {{Auth requirements, data sensitivity, compliance}}
- **Scale:** {{Expected users, data volume, concurrency}}
- **Accessibility:** {{Standards, requirements}}
- **Internationalisation:** {{Languages, regions}}

## Constraints

- {{Hard constraint 1}}
- {{Hard constraint 2}}
- {{...}}

## Edge Cases

- {{Error scenario 1 — what should happen}}
- {{Empty state 1 — what the user sees}}
- {{Concurrency conflict — resolution strategy}}
- {{...}}

## Out of Scope

<!-- Explicitly list what is NOT included, to prevent scope creep. -->

- {{Item 1}}
- {{Item 2}}

## Future Considerations

<!-- Ideas raised during discovery but not in current scope. -->

- {{Idea 1}}
- {{Idea 2}}
