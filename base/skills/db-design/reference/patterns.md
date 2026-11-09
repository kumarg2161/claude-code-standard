# Database Design Patterns

## PostgreSQL/MySQL
- UUIDs for public IDs, BIGSERIAL for internal PKs
- created_at/updated_at on every table (trigger for updated_at)
- Soft delete (deleted_at) unless storage matters
- FK with proper ON DELETE
- Check constraints for business rules
- Partial indexes where applicable
- Produce: ERD description, CREATE TABLE, indexes with justification, migrations (up+down)

## MongoDB
- Collection structure with sample docs
- Indexes: compound, TTL, text search
- Embedding vs referencing with justification

## DynamoDB
- PK/SK patterns with access pattern mapping
- GSI/LSI design
- Single-table vs multi-table decision
- Capacity mode recommendation

## Redis
- Key naming: service:entity:id:field
- Data structure selection (String/Hash/Set/SortedSet/Stream)
- TTL strategy, memory estimation
