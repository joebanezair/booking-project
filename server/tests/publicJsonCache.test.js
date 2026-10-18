import test from "node:test";
import assert from "node:assert/strict";
import { publicJsonCache } from "../middleware/publicJsonCache.js";

function invoke(middleware, { method = "GET", url = "/api/public/browse", headers = {}, statusCode = 200, body = { items: [1] } } = {}) {
  const req = { method, originalUrl: url, headers };
  const result = { calls: 0, headers: {}, sent: null };
  const res = {
    statusCode,
    setHeader(key, value) { result.headers[key.toLowerCase()] = value; },
    getHeader(key) { return result.headers[key.toLowerCase()]; },
    json(value) { result.sent = value; return res; }
  };
  middleware(req, res, () => { result.calls++; res.json(body); });
  return result;
}

test("public reads hit cache, with no browser persistence", () => {
  const middleware = publicJsonCache();
  const first = invoke(middleware);
  const second = invoke(middleware, { body: { items: [2] } });
  assert.equal(first.headers["x-cache"], "MISS");
  assert.equal(second.headers["x-cache"], "HIT");
  assert.equal(second.headers["cache-control"], "no-store");
  assert.deepEqual(second.sent, { items: [1] });
  assert.equal(second.calls, 0);
});

test("different URLs have independent cache entries", () => {
  const middleware = publicJsonCache();
  assert.equal(invoke(middleware, { url: "/browse?page=1" }).headers["x-cache"], "MISS");
  assert.equal(invoke(middleware, { url: "/browse?page=2" }).headers["x-cache"], "MISS");
});

test("authenticated requests and writes bypass cache", () => {
  const middleware = publicJsonCache();
  assert.equal(invoke(middleware, { headers: { authorization: "Bearer secret" } }).headers["x-cache"], undefined);
  assert.equal(invoke(middleware, { headers: { cookie: "session=x" } }).headers["x-cache"], undefined);
  assert.equal(invoke(middleware, { method: "POST" }).headers["x-cache"], undefined);
});

test("errors are not cached", () => {
  const middleware = publicJsonCache();
  invoke(middleware, { statusCode: 500 });
  assert.equal(invoke(middleware).headers["x-cache"], "MISS");
});

test("disabled cache always bypasses", () => {
  const middleware = publicJsonCache({ ttlMs: 0 });
  assert.equal(invoke(middleware).headers["x-cache"], undefined);
});
