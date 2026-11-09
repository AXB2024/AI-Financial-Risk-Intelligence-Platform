const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const setCookie = response.headers.get('set-cookie');
  const body = await response.json().catch(() => ({}));
  return { response, body, cookie: setCookie };
}

function cookieHeader(setCookie) {
  return String(setCookie || '')
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function registerUser(label) {
  const email = `tenant-${label}-${Date.now()}@example.com`;
  const { response, body, cookie } = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Tenant ${label}`,
      email,
      password: 'password123',
    }),
  });
  if (!response.ok) {
    throw new Error(`register ${label} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return { user: body.user, cookie: cookieHeader(cookie) };
}

async function main() {
  const tenantA = await registerUser('a');
  const tenantB = await registerUser('b');

  const create = await request('/portfolio', {
    method: 'POST',
    headers: { Cookie: tenantA.cookie },
    body: JSON.stringify({
      name: 'Tenant A Portfolio',
      assets: [{ symbol: 'AAPL', weight: 1, quantity: 10 }],
    }),
  });
  if (!create.response.ok) {
    throw new Error(`create portfolio failed: ${create.response.status} ${JSON.stringify(create.body)}`);
  }

  const tenantBList = await request('/portfolios', {
    headers: { Cookie: tenantB.cookie },
  });
  if (!tenantBList.response.ok) {
    throw new Error(`tenant B list failed: ${tenantBList.response.status} ${JSON.stringify(tenantBList.body)}`);
  }

  const leaked = tenantBList.body.some((portfolio) => portfolio.id === create.body.id);
  if (leaked) {
    throw new Error('tenant isolation failed: tenant B could see tenant A portfolio');
  }

  const directRead = await request(`/portfolios/${create.body.id}`, {
    headers: { Cookie: tenantB.cookie },
  });
  if (directRead.response.status !== 404) {
    throw new Error(`tenant isolation failed: direct read returned ${directRead.response.status}`);
  }

  console.log('tenant isolation smoke test passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
