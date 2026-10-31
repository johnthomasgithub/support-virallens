// Loaded via `node --import` before any test file, so config sees these values
// regardless of the OS shell (inline `NODE_ENV=test cmd` doesn't work on Windows).
// They are set before dotenv runs, so a developer's local .env can't leak into tests.
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.OPENROUTER_MODEL = 'test/primary-model';
process.env.OPENROUTER_FALLBACK_MODEL = 'test/fallback-model';
process.env.JWT_SECRET = 'test-jwt-secret';
