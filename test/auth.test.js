import assert from "node:assert/strict";
import test from "node:test";

import jwt from "jsonwebtoken";

import { createVerifyToken } from "../src/middleware/authMiddleware.js";
import { createMockResponse } from "../testsupport/mockHttp.js";

test("verifyToken attaches account details for a valid session", async () => {
  const token = jwt.sign(
    { account_id: "acct_1", session_id: "session_1", roles: ["player"], primaryRole: "player" },
    "test-secret"
  );
  const verifyToken = createVerifyToken({
    getUserByAccountId: async () => ({ sessionid: "session_1" }),
    verifyJwt: jwt.verify,
    jwtSecret: "test-secret",
  });
  const req = { cookies: { token } };
  const res = createMockResponse();
  let nextCalled = false;

  await verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.accountID, "acct_1");
  assert.deepEqual(req.roles, ["player"]);
  assert.equal(req.primaryRole, "player");
  assert.equal(res.statusCode, 200);
});

test("verifyToken clears the cookie when the session has been invalidated", async () => {
  const token = jwt.sign(
    { account_id: "acct_2", session_id: "stale_session" },
    "test-secret"
  );
  const verifyToken = createVerifyToken({
    getUserByAccountId: async () => ({ sessionid: "current_session" }),
    verifyJwt: jwt.verify,
    jwtSecret: "test-secret",
  });
  const req = { cookies: { token } };
  const res = createMockResponse();
  let nextCalled = false;

  await verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    error: "Session invalidated. Please login again",
    sessionInvalid: true,
  });
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.clearedCookies[0].name, "token");
});
