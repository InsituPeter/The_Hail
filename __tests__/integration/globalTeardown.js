/**
 * globalTeardown — runs once after all integration tests complete.
 *
 * The Prisma client instances live in the test worker processes, not here,
 * so there is nothing to disconnect. The database is left intact between
 * runs so the next run can skip re-creating it and only applies new migrations.
 */

module.exports = async () => {
    // No-op — test worker processes disconnect Prisma in their own afterAll hooks.
}
