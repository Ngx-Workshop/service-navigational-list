import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  AuthClientService,
  AuthenticationGuard,
  RemoteAuthGuard,
  RolesGuard,
} from '@tmdjr/ngx-auth-client';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Callable CommonJS Supertest.
import request = require('supertest');
import type { Server } from 'node:http';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

describe('Menu HTTP compatibility (isolated)', () => {
  let app: INestApplication<Server>;
  const service = {
    findAll: jest.fn(() => []),
    getMenuHierarchy: jest.fn(() => ({
      domain: 'ADMIN',
      structuralSubtypes: {},
    })),
    create: jest.fn(() => ({ _id: '507f1f77bcf86cd799439011' })),
  };
  let remote: RemoteAuthGuard;
  let remoteActivate: jest.SpiedFunction<RemoteAuthGuard['canActivate']>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MenuController],
      providers: [
        { provide: MenuService, useValue: service },
        RemoteAuthGuard,
        { provide: AuthClientService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    remote = module.get(RemoteAuthGuard);
    const reflector = new Reflector();
    remoteActivate = jest.spyOn(remote, 'canActivate').mockResolvedValue(false);
    app.useGlobalGuards(
      new AuthenticationGuard(reflector, remote),
      new RolesGuard(reflector)
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('keeps public reads and exact Boolean query parsing', async () => {
    await request(app.getHttpServer())
      .get('/navigational-list?archived=false&domain=ADMIN')
      .expect(200, []);
    expect(service.findAll).toHaveBeenLastCalledWith(
      'ADMIN',
      undefined,
      undefined,
      false,
      undefined
    );
    await request(app.getHttpServer())
      .get('/navigational-list?archived=invalid')
      .expect(200);
    expect(service.findAll).toHaveBeenLastCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    await request(app.getHttpServer())
      .get('/navigational-list/hierarchy/ADMIN?includeArchived=True')
      .expect(200);
    expect(service.getMenuHierarchy).toHaveBeenLastCalledWith('ADMIN', false);
    expect(remoteActivate).not.toHaveBeenCalled();
  });

  it('rejects anonymous writes and non-admin users, then validates admin input', async () => {
    await request(app.getHttpServer())
      .post('/navigational-list')
      .send({})
      .expect(401);
    jest.spyOn(remote, 'canActivate').mockImplementation((context) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user?: { role: string } }>();
      req.user = { role: 'regular' };
      return Promise.resolve(true);
    });
    await request(app.getHttpServer())
      .post('/navigational-list')
      .send({})
      .expect(403);
    jest.spyOn(remote, 'canActivate').mockImplementation((context) => {
      context.switchToHttp().getRequest<{ user?: { role: string } }>().user = {
        role: 'admin',
      };
      return Promise.resolve(true);
    });
    await request(app.getHttpServer())
      .post('/navigational-list')
      .send({ sortId: -1 })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/navigational-list')
      .send({
        menuItemText: 'Test',
        routePath: '/',
        sortId: 0,
        domain: 'ADMIN',
        structuralSubtype: 'NAV',
        state: 'FULL',
      })
      .expect(201, { _id: '507f1f77bcf86cd799439011' });
  });
});
