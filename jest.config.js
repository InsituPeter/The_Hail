/** @type {import('jest').Config} */
module.exports = {
    projects: [
        // ── Unit tests ────────────────────────────────────────────────────────
        // Pure in-process tests; all external dependencies are mocked.
        // Runs in parallel (default worker pool).
        {
            displayName: 'unit',
            testMatch: ['**/__tests__/unit/**/*.test.js'],
            testEnvironment: 'node',
            clearMocks: true,
        },

        // ── Integration tests ─────────────────────────────────────────────────
        // Hit a real PostgreSQL database (hail_db_test). Must run serially so
        // tests don't race on shared state. globalSetup runs prisma migrate
        // deploy before any test file is loaded.
        {
            displayName: 'integration',
            testMatch: ['**/__tests__/integration/**/*.test.js'],
            testEnvironment: 'node',
            clearMocks: true,
            maxWorkers: 1,
            globalSetup:    './__tests__/integration/globalSetup.js',
            globalTeardown: './__tests__/integration/globalTeardown.js',
        },
    ],
}
