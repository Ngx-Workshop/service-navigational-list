import { Reflector } from '@nestjs/core';
import {
  AuthenticationGuard,
  RemoteAuthGuard,
  RolesGuard,
} from '@tmdjr/ngx-auth-client';
import type { Server } from 'node:http';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Match callable Supertest in CommonJS service builds.
import request = require('supertest');
import { ObservabilityModule } from './observability.module';
import {
  createServiceLogger,
  httpLoggingMiddleware,
  observeOperation,
} from './observability';

const domainLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

@Controller('items')
class TestController {
  @Get(':id')
  get() {
    return observeOperation(
      domainLogger,
      'menu.update',
      () =>
        new Promise<{ ok: boolean }>((resolve) =>
          setTimeout(() => resolve({ ok: true }), 5)
        )
    );
  }
}

describe('Service observability', () => {
  let app: INestApplication<Server>;
  const log = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(httpLoggingMiddleware({ log, warn, error }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves an anonymous, non-cached heartbeat without database or auth providers', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      status: 'ok',
      info: { heartbeat: { status: 'up' } },
      error: {},
      details: { heartbeat: { status: 'up' } },
    });
    expect(log).not.toHaveBeenCalled();
    expect(domainLogger.log).not.toHaveBeenCalled();
    await request(app.getHttpServer()).head('/health').expect(200);
    expect(log).not.toHaveBeenCalled();
    expect(domainLogger.log).not.toHaveBeenCalled();
  });

  it('logs route templates and timings without request data or concrete identifiers', async () => {
    const response = await request(app.getHttpServer())
      .get('/items/private-person?token=private-query')
      .set('Authorization', 'Bearer private-auth')
      .set('Cookie', 'session=private-cookie')
      .expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request',
        method: 'GET',
        route: '/items/:id',
        statusCode: 200,
        durationMs: expect.any(Number) as unknown,
        requestId: response.headers['x-request-id'],
      })
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-');
  });

  it('logs unknown routes without their raw paths or query values', async () => {
    await request(app.getHttpServer())
      .get('/private-missing?secret=private-query')
      .expect(404);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/unmatched', statusCode: 404 })
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-');
  });

  it('isolates concurrent async operations and ignores incoming correlation content', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer())
        .get('/items/first')
        .set('X-Request-ID', 'private-secret'),
      request(app.getHttpServer())
        .get('/items/second')
        .set('X-Request-ID', 'a'.repeat(200)),
    ]);
    const ids = responses.map((response) => response.headers['x-request-id']);
    expect(new Set(ids).size).toBe(2);
    for (const requestId of ids) {
      expect(domainLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'menu.update',
          outcome: 'success',
          requestId,
          operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
          durationMs: expect.any(Number) as unknown,
        })
      );
      expect(log).toHaveBeenCalledWith(expect.objectContaining({ requestId }));
    }
    expect(domainLogger.log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(domainLogger.log.mock.calls)).not.toContain(
      'private-secret'
    );
  });

  it('does not provide a write endpoint for heartbeat', async () => {
    await request(app.getHttpServer())
      .post('/health')
      .send({ secret: 'private-body' })
      .expect(404);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-body');
  });

  describe('Native domain operation events', () => {
    it('emits safe contextual JSON for success and failure, preserving results/errors', async () => {
      const stdout = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      const stderr = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);
      const logger = createServiceLogger();
      const failure = new Error('private-token-cookie-body-content');
      try {
        const result = { body: 'private-content' };
        expect(
          await observeOperation(
            {
              log: (entry: object) => logger.log(entry, 'MenuService'),
              warn: (entry: object) => logger.warn(entry, 'MenuService'),
              error: (entry: object) => logger.error(entry, 'MenuService'),
            },
            'menu.create',
            () => Promise.resolve(result)
          )
        ).toBe(result);
        await expect(
          observeOperation(logger, 'menu.reorder', () =>
            Promise.reject(failure)
          )
        ).rejects.toBe(failure);
        const lines = [...stdout.mock.calls, ...stderr.mock.calls].map(
          ([line]) => String(line)
        );
        const entries: unknown[] = lines.map(
          (line) => JSON.parse(line) as unknown
        );
        expect(entries).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              level: 'log',
              context: 'MenuService',
              message: expect.objectContaining({
                event: 'menu.create',
                outcome: 'success',
                operationId: expect.any(String) as unknown,
              }) as unknown,
            }),
            expect.objectContaining({
              level: 'error',
              message: expect.objectContaining({
                event: 'menu.reorder',
                outcome: 'failure',
                statusCode: 500,
              }) as unknown,
            }),
          ])
        );
        expect(lines.join('')).not.toContain('private-');
        expect(lines.join('')).not.toContain('requestId');
      } finally {
        stdout.mockRestore();
        stderr.mockRestore();
      }
    });
  });

  it('uses native Nest JSON logging with a contextual, structured message', () => {
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    try {
      createServiceLogger().log({ event: 'test_event' }, 'ObservabilityTest');
      expect(write).toHaveBeenCalled();
      const entry: unknown = JSON.parse(String(write.mock.calls[0][0]));
      expect(entry).toEqual(
        expect.objectContaining({
          level: 'log',
          context: 'ObservabilityTest',
          message: { event: 'test_event' },
        })
      );
    } finally {
      write.mockRestore();
    }
  });
});

describe('Heartbeat with production authentication guards', () => {
  let app: INestApplication<Server>;
  const remote = { canActivate: jest.fn(() => false) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthenticationGuard(reflector, remote as unknown as RemoteAuthGuard),
      new RolesGuard(reflector)
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('allows GET/HEAD heartbeat while protected routes still require authentication', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).head('/health').expect(200);
    expect(remote.canActivate).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get('/items/private').expect(401);
    expect(remote.canActivate).toHaveBeenCalled();
    await request(app.getHttpServer()).post('/health').expect(404);
  });
});
