/**
 * Vitest setup.
 *
 * Tests need deterministic secret material, but production must never fall back
 * to a default. This file supplies an isolated test-only secret when the ambient
 * environment does not provide one, so the suite is reproducible on any machine
 * without weakening the production fail-closed behaviour in `src/lib/secrets.ts`.
 *
 * This runs only inside the test runner; it is not imported by application code
 * and has no effect on a deployed build.
 */
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 24) {
  process.env.AUTH_SECRET = 'vitest-isolated-test-secret-value-000000';
}
