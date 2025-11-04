import axios from 'axios';

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

const E2E_URL = process.env.E2E_URL;
const API_TOKEN = process.env.API_TOKEN || '';

if (!E2E_URL) {
  console.error('E2E_URL is not set. Set E2E_URL to the base URL of the app (e.g. http://localhost:1337)');
  process.exit(1);
}

const client = axios.create({
  baseURL: E2E_URL,
  timeout: 5000,
  validateStatus: () => true,
  headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : undefined,
});

async function request(path, opts = {}) {
  try {
    const res = await client.get(path, opts);
    return res;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error(`Connection error when reaching ${E2E_URL}: ${err.message}`);
    } else {
      console.error(`Request error: ${err.message}`);
    }
    throw err;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
  }
}

async function run() {
  console.log(`Running E2E tests against ${E2E_URL}`);

  console.log('Test 1: missing c parameter -> expect 400 and error message');
  const r1 = await request('/api');
  if (r1.status !== 400) throw new Error(`/api without c expected status 400, got ${r1.status}`);
  if (!r1.data || r1.data.error !== 'No code provided') throw new Error(`/api without c expected JSON { error: 'No code provided' }, got ${JSON.stringify(r1.data)}`);
  console.log('  ✓ Test 1 passed');

  console.log("Test 2: valid code '1+1' -> expect 200 and result 2");
  const code = '1+1';
  const encoded = Buffer.from(code).toString('base64');
  const r2 = await request(`/api?c=${encodeURIComponent(encoded)}`);
  if (r2.status !== 200) throw new Error(`/api with code expected status 200, got ${r2.status}`);
  if (!('result' in r2.data)) throw new Error(`/api with code expected JSON with 'result', got ${JSON.stringify(r2.data)}`);
  if (Number(r2.data.result) !== 2) throw new Error(`/api with code expected result 2, got ${JSON.stringify(r2.data.result)}`);
  console.log('  ✓ Test 2 passed');

  console.log("Test 3: invalid code 'throw new Error(\"x\")' -> expect 400");
  const badCode = 'throw new Error("x")';
  const badEncoded = Buffer.from(badCode).toString('base64');
  const r3 = await request(`/api?c=${encodeURIComponent(badEncoded)}`);
  if (r3.status !== 400) throw new Error(`/api with invalid code expected status 400, got ${r3.status}`);
  if (!r3.data || r3.data.error !== 'Failed to execute code') throw new Error(`/api with invalid code expected JSON { error: 'Failed to execute code' }, got ${JSON.stringify(r3.data)}`);
  console.log('  ✓ Test 3 passed');

  console.log('\nAll E2E tests passed');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nE2E tests failed:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
