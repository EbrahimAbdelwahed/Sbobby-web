import assert from "node:assert/strict";

const baseUrl = new URL(process.env.VERIFY_BASE_URL ?? "http://localhost:3000");

function url(pathname) {
  return new URL(pathname, baseUrl).toString();
}

async function fetchJson(pathname) {
  const response = await fetch(url(pathname), {
    headers: {
      accept: "application/json",
    },
    redirect: "manual",
  });

  const contentType = response.headers.get("content-type") ?? "";
  assert.match(
    contentType,
    /\bapplication\/json\b/,
    `${pathname} should return JSON, got ${contentType || "no content-type"}`,
  );

  return {
    response,
    body: await response.json(),
  };
}

async function checkStatus() {
  const { response, body } = await fetchJson("/api/status/");

  assert.equal(response.status, 200, "/api/status/ should return 200");
  assert.equal(typeof body.database, "object", "/api/status/ should include database");
  assert.equal(typeof body.database.mode, "string", "/api/status/ should include database.mode");
}

async function checkAuthProviders() {
  const { response, body } = await fetchJson("/api/auth/providers/");

  assert.equal(response.status, 200, "/api/auth/providers/ should return 200");
  assert.equal(typeof body.google, "object", "/api/auth/providers/ should expose Google");
  assert.equal(body.google.id, "google", "Google provider id should be google");
  assert.equal(typeof body.google.callbackUrl, "string", "Google provider should include callbackUrl");
  assert.ok(
    body.google.callbackUrl.includes("/api/auth/callback/google"),
    "Google callbackUrl should include /api/auth/callback/google",
  );
}

async function checkQuestionsUnauthorized() {
  const { response } = await fetchJson("/api/questions/");

  assert.equal(response.status, 401, "/api/questions/ without a session should return 401");
}

async function checkRootRedirect() {
  const response = await fetch(url("/"), {
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    assert.ok(location, "/ should include a Location header when redirecting");
    assert.equal(new URL(location, baseUrl).pathname, "/studio", "/ should redirect to /studio");
    return;
  }

  assert.ok(response.ok, `/ should redirect to /studio or return 2xx, got ${response.status}`);
}

const checks = [
  ["/api/status/", checkStatus],
  ["/api/auth/providers/", checkAuthProviders],
  ["/api/questions/", checkQuestionsUnauthorized],
  ["/", checkRootRedirect],
];

function hasCauseCode(error, codes) {
  if (!error || typeof error !== "object") {
    return false;
  }
  if ("code" in error && codes.has(error.code)) {
    return true;
  }
  if ("cause" in error && hasCauseCode(error.cause, codes)) {
    return true;
  }
  if (Array.isArray(error.errors)) {
    return error.errors.some((item) => hasCauseCode(item, codes));
  }
  return false;
}

try {
  for (const [name, check] of checks) {
    await check();
    console.log(`ok ${name}`);
  }
} catch (error) {
  if (hasCauseCode(error, new Set(["ECONNREFUSED", "ENOTFOUND", "EPERM"]))) {
    console.error(`Smoke target is not reachable: ${baseUrl.toString()}`);
  }
  throw error;
}
