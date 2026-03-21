'use strict';

describe('Zod Validation Middleware', () => {
  let validate;

  beforeAll(() => {
    validate = require('../src/middleware/validate').validate;
  });

  function createMockReqRes(overrides = {}) {
    const req = {
      body: overrides.body || {},
      query: overrides.query || {},
      params: overrides.params || {},
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return { req, res };
  }

  it('should call next() when input is valid', () => {
    const { z } = require('zod');
    const schema = z.object({
      body: z.object({ name: z.string() }),
      query: z.object({}),
      params: z.object({}),
    });

    const middleware = validate(schema);
    const { req, res } = createMockReqRes({ body: { name: 'Alice' } });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.validated).toBeDefined();
    expect(req.validated.body.name).toBe('Alice');
  });

  it('should return 400 with structured errors on invalid input', () => {
    const { z } = require('zod');
    const schema = z.object({
      body: z.object({ name: z.string(), age: z.number() }),
      query: z.object({}),
      params: z.object({}),
    });

    const middleware = validate(schema);
    const { req, res } = createMockReqRes({ body: { name: 123 } });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Invalid request');
    expect(res.body.error.details).toBeDefined();
  });
});

describe('Admin Auth Middleware', () => {
  let adminAuth;
  const TEST_KEY = 'test-admin-key-12345';

  beforeAll(() => {
    process.env.ADMIN_API_KEY = TEST_KEY;
    adminAuth = require('../src/middleware/auth').adminAuth;
  });

  afterAll(() => {
    delete process.env.ADMIN_API_KEY;
  });

  function createMockReqRes(headers = {}) {
    const req = { headers };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return { req, res };
  }

  it('should call next() when admin key is valid', () => {
    const { req, res } = createMockReqRes({ 'x-admin-key': TEST_KEY });
    const next = jest.fn();

    adminAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 when admin key is missing', () => {
    const { req, res } = createMockReqRes({});
    const next = jest.fn();

    adminAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should return 403 when admin key is wrong', () => {
    const { req, res } = createMockReqRes({ 'x-admin-key': 'wrong-key' });
    const next = jest.fn();

    adminAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});
