import { CosmosClient, Container } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT || 'https://localhost:8081';
const key = process.env.COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const databaseName = process.env.COSMOS_DATABASE_NAME || 'appdb';
const containerName = process.env.COSMOS_CONTAINER_NAME || 'incidents';

let _container: Container | null = null;

export function getContainer(): Container {
  if (!_container) {
    const client = new CosmosClient({ endpoint, key });
    _container = client.database(databaseName).container(containerName);
  }
  return _container;
}

