import assert from "node:assert/strict";
import test from "node:test";

import { createUserController } from "../src/controllers/userController.js";
import { createMockResponse } from "../testsupport/mockHttp.js";

test("updateUserStats persists the result and returns the standardized stats DTO", async () => {
  const calls = [];
  const controller = createUserController({
    jwtSecret: "test-secret",
    updateUserStatsInStore: async (accountId, wpm, won) => {
      calls.push({ accountId, wpm, won });
    },
    getUserStatsFromStore: async () => ({
      race_avg: "72.6",
      race_last: "81",
      race_best: "99",
      race_won: "4",
      race_completed: "7",
    }),
  });
  const req = {
    accountID: "acct_7",
    body: { wpm: 81, won: true },
  };
  const res = createMockResponse();

  await controller.updateUserStats(req, res);

  assert.deepEqual(calls, [{ accountId: "acct_7", wpm: 81, won: true }]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    stats: {
      race_avg: 72.6,
      race_last: 81,
      race_best: 99,
      race_won: 4,
      race_completed: 7,
    },
  });
});

test("getUserStats rejects unauthenticated requests", async () => {
  const controller = createUserController({ jwtSecret: "test-secret" });
  const req = { body: {} };
  const res = createMockResponse();

  await controller.getUserStats(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Missing auth token" });
});
