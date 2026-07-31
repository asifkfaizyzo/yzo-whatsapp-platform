SELECT migration_name, finished_at, applied_steps_count 
FROM _prisma_migrations
WHERE finished_at IS NULL
AND applied_steps_count = 0;