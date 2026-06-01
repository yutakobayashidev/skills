# User Service Migration

The team is migrating the user service from a monolith to microservices.
The current stack uses MySQL for the user database. The team is considering
moving to PostgreSQL for better JSONB support and horizontal scaling.
Two senior engineers disagree on the approach: one wants to keep MySQL
with replication, the other wants PostgreSQL with Citus.
