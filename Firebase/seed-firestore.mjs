import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === 'boolean') return { booleanValue: value };

  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (typeof value === 'object') {
    const fields = {};
    Object.keys(value).forEach((key) => {
      fields[key] = toFirestoreValue(value[key]);
    });
    return {
      mapValue: { fields },
    };
  }

  return { stringValue: String(value) };
}

async function main() {
  const configPath = path.resolve(__dirname, '..', 'JS', 'firebase-config.js');
  const seedPath = path.resolve(__dirname, 'products.seed.json');

  const configText = await readFile(configPath, 'utf8');
  const apiKeyMatch = configText.match(/apiKey:\s*'([^']+)'/);
  const projectIdMatch = configText.match(/projectId:\s*'([^']+)'/);
  const collectionMatch = configText.match(/productsCollection:\s*'([^']+)'/);

  if (!apiKeyMatch || !projectIdMatch) {
    throw new Error('Could not read apiKey/projectId from JS/firebase-config.js');
  }

  const apiKey = apiKeyMatch[1];
  const projectId = projectIdMatch[1];
  const collection = collectionMatch ? collectionMatch[1] : 'products';

  const seedText = await readFile(seedPath, 'utf8');
  const products = JSON.parse(seedText);

  if (!Array.isArray(products) || !products.length) {
    throw new Error('Seed file is empty or invalid');
  }

  const results = [];
  for (let i = 0; i < products.length; i += 1) {
    const product = products[i] || {};
    const fallbackSlug = `seed-${i + 1}`;
    const slug = String(product.slug || fallbackSlug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallbackSlug;

    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}?key=${encodeURIComponent(apiKey)}`;

    const fields = {};
    Object.keys(product).forEach((key) => {
      fields[key] = toFirestoreValue(product[key]);
    });

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Seed failed for ${slug}: ${response.status} ${err}`);
    }

    results.push(slug);
  }

  console.log(`Seeded ${results.length} documents to ${collection}: ${results.join(', ')}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
