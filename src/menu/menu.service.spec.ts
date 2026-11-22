import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { model } from 'mongoose';
import { MenuService } from './menu.service';
import { MenuOrderingService } from './menu-ordering.service';
import {
  DomainEnum,
  MenuItemDoc,
  MenuItemSchema,
  RoleEnum,
  StateEnum,
  StructuralSubtypeEnum,
} from './schemas/menu-item.schema';

const Fixture = model('MaintenanceFixture', MenuItemSchema);
const movingId = '507f1f77bcf86cd799439011';
const parentId = '507f1f77bcf86cd799439012';

function item(sortId: number, parent?: string) {
  return new Fixture({
    _id: movingId,
    menuItemText: 'private-content',
    routePath: '/private-route',
    domain: DomainEnum.WORKSHOP,
    structuralSubtype: StructuralSubtypeEnum.NAV,
    state: StateEnum.FULL,
    sortId,
    parentId: parent,
  });
}

describe('Menu domain compatibility', () => {
  const save = jest.fn();
  const find = jest.fn<unknown, [unknown]>();
  const findById = jest.fn();
  const findByIdAndUpdate = jest.fn();
  const findByIdAndDelete = jest.fn();
  const bulkWrite = jest.fn();
  const sort = jest.fn();
  const exec = jest.fn();
  const modelDouble = Object.assign(
    jest.fn(() => ({ save })),
    { find, findById, findByIdAndUpdate, findByIdAndDelete, bulkWrite }
  );
  let service: MenuService;
  const log = jest.fn<void, [unknown]>();
  const warn = jest.fn<void, [unknown]>();
  const error = jest.fn<void, [unknown]>();

  beforeEach(async () => {
    jest.resetAllMocks();
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((entry: unknown) => log(entry));
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((entry: unknown) => warn(entry));
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((entry: unknown) => error(entry));
    sort.mockReturnValue({ exec });
    find.mockReturnValue({ sort });
    findById.mockReturnValue({ exec });
    findByIdAndUpdate.mockReturnValue({ exec });
    findByIdAndDelete.mockReturnValue({ exec });
    modelDouble.mockImplementation(() => ({ save }));
    const module = await Test.createTestingModule({
      providers: [
        MenuService,
        MenuOrderingService,
        { provide: getModelToken(MenuItemDoc.name), useValue: modelDouble },
      ],
    }).compile();
    service = module.get(MenuService);
    log.mockClear();
    warn.mockClear();
    error.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('preserves all filters, false archive values and sorting', async () => {
    exec.mockResolvedValue([]);
    await service.findAll(
      DomainEnum.ADMIN,
      StructuralSubtypeEnum.HEADER,
      StateEnum.COMPACT,
      false,
      RoleEnum.Admin
    );
    expect(find).toHaveBeenLastCalledWith({
      domain: 'ADMIN',
      structuralSubtype: 'HEADER',
      state: 'COMPACT',
      archived: false,
      role: 'admin',
    });
    expect(sort).toHaveBeenLastCalledWith({ sortId: 1 });
    await service.findAll();
    expect(find).toHaveBeenLastCalledWith({});
    await service.findByDomain(DomainEnum.WORKSHOP);
    expect(find).toHaveBeenLastCalledWith({
      domain: 'WORKSHOP',
      archived: false,
    });
    expect(sort).toHaveBeenLastCalledWith({
      structuralSubtype: 1,
      state: 1,
      sortId: 1,
    });
    await service.findByDomainAndStructuralSubtype(
      DomainEnum.ADMIN,
      StructuralSubtypeEnum.NAV,
      true
    );
    expect(find).toHaveBeenLastCalledWith({
      domain: 'ADMIN',
      structuralSubtype: 'NAV',
    });
    expect(sort).toHaveBeenLastCalledWith({ state: 1, sortId: 1 });
    await service.findByDomainStructuralSubtypeAndState(
      DomainEnum.ADMIN,
      StructuralSubtypeEnum.NAV,
      StateEnum.FULL
    );
    expect(find).toHaveBeenLastCalledWith({
      domain: 'ADMIN',
      structuralSubtype: 'NAV',
      state: 'FULL',
      archived: false,
    });
  });

  it('groups original documents without converting identifiers or dates', async () => {
    const first = item(1);
    const second = item(2);
    second.state = StateEnum.COMPACT;
    exec.mockResolvedValue([first, second]);
    const result = await service.getMenuHierarchy(DomainEnum.WORKSHOP, true);
    expect(find).toHaveBeenCalledWith({ domain: 'WORKSHOP' });
    expect(result.structuralSubtypes.NAV?.states.FULL?.[0]).toBe(first);
    expect(result.structuralSubtypes.NAV?.states.COMPACT?.[0]).toBe(second);
    exec.mockResolvedValue([]);
    expect(await service.getMenuHierarchy(DomainEnum.ADMIN)).toEqual({
      domain: 'ADMIN',
      structuralSubtypes: {},
    });
  });

  it('maps duplicate writes but preserves original storage failures and not-found errors', async () => {
    const dto = {
      menuItemText: 'private',
      routePath: '/',
      sortId: 0,
      domain: DomainEnum.ADMIN,
      structuralSubtype: StructuralSubtypeEnum.NAV,
      state: StateEnum.FULL,
    };
    save.mockRejectedValue({ code: 11000, message: 'private-secret' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'menu.create',
        outcome: 'failure',
        statusCode: 409,
      })
    );
    const failure = new Error('private-secret');
    save.mockRejectedValue(failure);
    await expect(service.create(dto)).rejects.toBe(failure);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'menu.create',
        outcome: 'failure',
        statusCode: 500,
      })
    );
    expect(
      JSON.stringify([...warn.mock.calls, ...error.mock.calls])
    ).not.toContain('private');
    exec.mockRejectedValueOnce({ code: 11000 });
    await expect(service.update(movingId, {})).rejects.toBeInstanceOf(
      ConflictException
    );
    exec.mockResolvedValue(null);
    await expect(service.findOne(movingId)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.update(movingId, {})).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.remove(movingId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('archives through timestamped update without changing other fields', async () => {
    const updated = item(1);
    exec.mockResolvedValue(updated);
    expect(await service.archive(movingId)).toBe(updated);
    expect(log).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdate).toHaveBeenLastCalledWith(
      movingId,
      { archived: true, lastUpdated: expect.any(Date) as unknown },
      { new: true }
    );
    await service.unarchive(movingId);
    expect(findByIdAndUpdate).toHaveBeenLastCalledWith(
      movingId,
      { archived: false, lastUpdated: expect.any(Date) as unknown },
      { new: true }
    );
  });

  it.each([0, 99])(
    'clamps root reorder position %s and preserves root sibling boundaries',
    async (position) => {
      const moving = item(2);
      const sibling = item(1);
      exec.mockResolvedValueOnce(moving).mockResolvedValueOnce([sibling]);
      if (position === 0) exec.mockResolvedValueOnce([sibling]);
      exec.mockResolvedValueOnce(moving);
      await service.reorderMenuItems({ _id: movingId, sortId: position });
      expect(find).toHaveBeenCalledWith({
        _id: { $ne: moving._id },
        domain: 'WORKSHOP',
        structuralSubtype: 'NAV',
        state: 'FULL',
        $or: [{ parentId: { $exists: false } }, { parentId: null }],
      });
      expect(findByIdAndUpdate).toHaveBeenLastCalledWith(
        movingId,
        {
          $unset: { parentId: '' },
          $set: {
            sortId: position === 0 ? 1 : 2,
            lastUpdated: expect.any(Date) as unknown,
          },
        },
        { new: true }
      );
      if (position === 99) expect(bulkWrite).not.toHaveBeenCalled();
      else
        expect(bulkWrite).toHaveBeenCalledWith([
          {
            updateOne: {
              filter: { _id: sibling._id },
              update: { $set: { sortId: 2 } },
            },
          },
        ]);
    }
  );

  it('closes old-parent gaps before inserting into the new parent', async () => {
    const moving = item(2, parentId);
    const sibling = item(3, parentId);
    exec
      .mockResolvedValueOnce(moving)
      .mockResolvedValueOnce([sibling])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(moving);
    await service.reorderMenuItems({
      _id: movingId,
      parentId: movingId,
      sortId: 8,
    });
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ parentId: moving.parentId })
    );
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ parentId: movingId })
    );
    expect(bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: sibling._id },
          update: { $set: { sortId: 1 } },
        },
      },
    ]);
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      movingId,
      {
        $set: {
          parentId: movingId,
          sortId: 1,
          lastUpdated: expect.any(Date) as unknown,
        },
      },
      { new: true }
    );
    expect(bulkWrite.mock.invocationCallOrder[0]).toBeLessThan(
      findByIdAndUpdate.mock.invocationCallOrder[0]
    );
  });

  it('propagates reorder storage failures without continuing writes', async () => {
    const failure = new Error('private-upstream-secret');
    exec
      .mockResolvedValueOnce(item(2, parentId))
      .mockResolvedValueOnce([item(3, parentId)]);
    bulkWrite.mockRejectedValueOnce(failure);
    await expect(
      service.reorderMenuItems({ _id: movingId, sortId: 1 })
    ).rejects.toBe(failure);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'menu.reorder',
        outcome: 'failure',
      })
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain('private');
  });

  it('preserves same-parent reorders and parent-to-root unsetting', async () => {
    const moving = item(2, parentId);
    exec
      .mockResolvedValueOnce(moving)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(moving);
    await service.reorderMenuItems({ _id: movingId, parentId, sortId: 2.7 });
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ parentId: moving.parentId })
    );
    expect(find).toHaveBeenCalledTimes(1);
    exec
      .mockResolvedValueOnce(moving)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(moving);
    await service.reorderMenuItems({ _id: movingId, sortId: 0 });
    expect(findByIdAndUpdate).toHaveBeenLastCalledWith(
      movingId,
      {
        $unset: { parentId: '' },
        $set: { sortId: 1, lastUpdated: expect.any(Date) as unknown },
      },
      { new: true }
    );
  });

  it('reports missing reorder items before writes and during final update', async () => {
    exec.mockResolvedValueOnce(null);
    await expect(
      service.reorderMenuItems({ _id: movingId, sortId: 1 })
    ).rejects.toThrow(`MenuItem with ID "${movingId}" not found`);
    expect(bulkWrite).not.toHaveBeenCalled();
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
    exec
      .mockResolvedValueOnce(item(1))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await expect(
      service.reorderMenuItems({ _id: movingId, sortId: 1 })
    ).rejects.toThrow(
      `MenuItem with ID "${movingId}" not found during final update`
    );
  });
});
