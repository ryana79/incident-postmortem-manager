// ─────────────────────────────────────────────────────────────────────────────
// Jest Test Setup
// ─────────────────────────────────────────────────────────────────────────────

// Set test environment variables
process.env.COSMOS_ENDPOINT = 'https://test-cosmos.documents.azure.com:443/';
process.env.COSMOS_KEY = 'test-key';
process.env.COSMOS_DATABASE_NAME = 'testdb';
process.env.COSMOS_CONTAINER_NAME = 'incidents';
process.env.GROQ_API_KEY = 'test-groq-key';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  console.log('Starting test suite...');
});

afterAll(() => {
  console.log('Test suite complete.');
});

