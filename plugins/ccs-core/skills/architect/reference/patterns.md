# Architecture Patterns Reference

## HLD Template
1. Requirements: Functional + Non-functional (scale, latency, availability)
2. Component diagram: Services, databases, queues, caches, external APIs
3. Data flow: Request path through the system
4. Tech choices: With justification and alternatives
5. Failure modes: What breaks, detection, recovery
6. Cost estimate: Rough AWS cost at stated scale

## LLD Template
1. Class/module structure with interfaces
2. Database schema with indexes
3. API contracts with TypeScript interfaces
4. Sequence diagrams for key flows
5. Error handling strategy
6. Testing approach

## Pattern Selection
- Monolith: <50K RPM, small team, fast iteration
- Microservices: Independent scaling, >100K RPM
- Serverless: Spiky traffic, event-driven, cost-sensitive
- Event-Driven: Decoupled, audit trails, eventual consistency OK
- CQRS: Read/write asymmetry, event sourcing

## Trade-off Table Format
| Criterion | Option A | Option B |
|-----------|----------|----------|
| Latency   |          |          |
| Cost      |          |          |
| Complexity|          |          |
| Scalability|         |          |
| Verdict   |          |          |

Always ask scale targets before designing.
