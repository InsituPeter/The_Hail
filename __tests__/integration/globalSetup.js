/**
 * globalSetup — runs once before all integration tests in a separate process.
 *
 * Responsibilities:
 *   1. Create the hail_db_test database if it does not exist.
 *   2. Apply all pending Prisma migrations so the schema is current.
 *
 * WHY docker exec FOR DB CREATION?
 * pg_hba.conf uses scram-sha-256 for TCP connections from non-loopback
 * addresses (Docker routes host→container traffic as a non-loopback IP).
 * psql inside the container uses the Unix socket, which is trusted — no
 * password required. This avoids any TCP auth complications entirely.
 *
 * WHY globalSetup INSTEAD OF beforeAll?
 * globalSetup runs once per Jest run (not once per test file). Migration is
 * idempotent — running it twice is harmless — but doing it once is faster.
 */

const { execSync } = require('child_process')
const path = require('path')

const TEST_DB_NAME = 'hail_db_test'
const TEST_DB_URL  = `postgresql://postgres:password@localhost:5433/${TEST_DB_NAME}`
const ROOT         = path.resolve(__dirname, '../..')

module.exports = async () => {
    // ── 1. Create test database if it does not exist ──────────────────────────
    // Use psql inside the container via the Unix socket (trust auth — no password).
    execSync(
        `docker exec hail_postgres_dev psql -U postgres -tc ` +
        `"SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'" ` +
        `| grep -q 1 || docker exec hail_postgres_dev psql -U postgres -c "CREATE DATABASE ${TEST_DB_NAME}"`,
        { shell: true, stdio: 'inherit' }
    )

    // ── 2. Apply migrations ───────────────────────────────────────────────────
    // Prisma uses its own connection layer (not the pg npm package) so it
    // handles scram-sha-256 correctly over TCP.
    execSync('npx prisma migrate deploy', {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        stdio: 'inherit',
    })
}
