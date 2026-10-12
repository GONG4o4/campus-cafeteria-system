const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");
const authTest = require("../routes/authTest");

const secret = "test-only-jwt-secret";
const previousSecret = process.env.JWT_SECRET;
const previousEnvironment = process.env.NODE_ENV;
let server;
let baseUrl;


before(async () => {
  process.env.JWT_SECRET = secret;
  process.env.NODE_ENV = "development";
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authTest);
  app.post("/customer", authenticate, authorizeRoles("student", "staff"),
    (req, res) => res.json({ user: req.user }));
  app.post("/operations", authenticate, authorizeRoles("cafeteria_staff"),
    (req, res) => res.json({ user: req.user }));
  app.get("/role-only", authorizeRoles("student"), (req, res) => res.sendStatus(200));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }

  if (previousEnvironment === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousEnvironment;
  }
});


function token(payload = { user_id: 1, role: "student" }, options = { expiresIn: "1h" }) {
  return jwt.sign(payload, secret, options);
}

async function request(path, authorization, body) {
  const options = { method: "GET", headers: {} };

  if (authorization !== undefined) {
    options.headers.Authorization = authorization;
  }

  if (body !== undefined) {
    options.method = "POST";
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  return fetch(baseUrl + path, options);
}

test("no token returns 401", async () => {
  const response = await request("/api/auth/test");
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Unauthorized" });
});

test("incorrect header format returns 401", async () => {
  const badHeaders = ["Bearer", "Basic abc", "Bearer a b"];
  for (const header of badHeaders) {
    const response = await request("/api/auth/test", header);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { message: "Unauthorized" });
  }
});

test("invalid token returns 401", async () => {
  const response = await request("/api/auth/test", "Bearer invalid");
  assert.equal(response.status, 401);
});

test("token signed with a different secret returns 401", async () => {
  const badToken = jwt.sign({ user_id: 1, role: "student" }, "wrong-secret", { expiresIn: "1h" });
  const response = await request("/api/auth/test", `Bearer ${badToken}`);
  assert.equal(response.status, 401);
});

test("expired token returns 401", async () => {
  const expiredToken = token(undefined, { expiresIn: -1 });
  const response = await request("/api/auth/test", `Bearer ${expiredToken}`);
  assert.equal(response.status, 401);
});

test("different signing algorithm returns 401", async () => {
  const badToken = token(undefined, { algorithm: "HS384", expiresIn: "1h" });
  const response = await request("/api/auth/test", `Bearer ${badToken}`);
  assert.equal(response.status, 401);
});

test("invalid identity claims and missing expiration return 401", async () => {
  for (const payload of [{ role: "student" }, { user_id: "1", role: "student" },
    { user_id: 0, role: "student" }, { user_id: 1 }, { user_id: 1, role: 42 }]) {
    const response = await request("/api/auth/test", `Bearer ${token(payload)}`);
    assert.equal(response.status, 401);
  }
  const noExpiration = jwt.sign({ user_id: 1, role: "student" }, secret);
  const response = await request("/api/auth/test", `Bearer ${noExpiration}`);
  assert.equal(response.status, 401);
});

test("valid login contract exposes only identity and role", async () => {
  const value = token({ user_id: 7, role: "student", password: "private", password_hash: "private" });
  const response = await request("/api/auth/test", `Bearer ${value}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: { user_id: 7, role: "student" } });
});

test("students and staff can access customer routes", async () => {
  for (const role of ["student", "staff"]) {
    const header = `Bearer ${token({ user_id: 1, role })}`;
    const customer = await request("/customer", header, {});
    assert.equal(customer.status, 200);
    const operations = await request("/operations", header, {});
    assert.equal(operations.status, 403);
  }
});

test("cafeteria staff can access operations but cannot access customer routes", async () => {
  const staffToken = token({ user_id: 1, role: "cafeteria_staff" });
  const operations = await request("/operations", `Bearer ${staffToken}`, {});
  assert.equal(operations.status, 200);

  const customer = await request("/customer", `Bearer ${staffToken}`, {});
  assert.equal(customer.status, 403);
});

test("body cannot elevate role and unknown roles are denied", async () => {
  for (const role of ["student", "unknown"]) {
    const response = await request("/operations", `Bearer ${token({ user_id: 1, role })}`,
      { role: "cafeteria_staff", user_id: 2 });
    assert.equal(response.status, 403);
  }
  const response = await request("/role-only");
  assert.equal(response.status, 401);
});

test("test endpoint is unavailable outside explicit development mode", async () => {
  try {
    for (const environment of ["production", "test", undefined]) {
      if (environment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = environment;
      }
      const response = await request("/api/auth/test", `Bearer ${token()}`);
      assert.equal(response.status, 404);
    }
  } finally {
    process.env.NODE_ENV = "development";
  }
});

test("missing server secret returns generic server error", async () => {
  delete process.env.JWT_SECRET;
  try {
    const response = await request("/api/auth/test", `Bearer ${token()}`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { message: "Internal server error" });
  } finally {
    process.env.JWT_SECRET = secret;
  }
});
