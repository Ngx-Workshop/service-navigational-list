import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateMenuItemDto,
  MenuHierarchyResponseDto,
  SortMenuItemDto,
  UpdateMenuItemDto,
} from './dto/menu-item.dto';
import {
  DomainEnum,
  MenuItemDoc,
  MenuItemDocument,
  RoleEnum,
  StateEnum,
  StructuralSubtypeEnum,
} from './schemas/menu-item.schema';

@Injectable()
export class MenuService {
  logger = new Logger(MenuService.name);

  constructor(
    @InjectModel(MenuItemDoc.name)
    private menuItemModel: Model<MenuItemDocument>
  ) {}

  async create(createMenuItemDto: CreateMenuItemDto): Promise<MenuItemDoc> {
    try {
      const createMenuItem = new this.menuItemModel({
        ...createMenuItemDto,
        lastUpdated: new Date(),
      });
      return await createMenuItem.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException(
          'MenuItem with these properties already exists'
        );
      }
      throw error;
    }
  }

  async findAll(
    domain?: DomainEnum,
    structuralSubtype?: StructuralSubtypeEnum,
    state?: StateEnum,
    archived?: boolean,
    role?: RoleEnum
  ): Promise<MenuItemDoc[]> {
    const filter: any = {};

    if (domain !== undefined) filter.domain = domain;
    if (structuralSubtype !== undefined)
      filter.structuralSubtype = structuralSubtype;
    if (state !== undefined) filter.state = state;
    if (archived !== undefined) filter.archived = archived;
    if (role !== undefined) filter.role = role;

    return await this.menuItemModel.find(filter).sort({ sortId: 1 }).exec();
  }

  async findOne(id: string): Promise<MenuItemDoc> {
    const menuItem = await this.menuItemModel.findById(id).exec();
    if (!menuItem) {
      throw new NotFoundException(`MenuItem with ID "${id}" not found`);
    }
    return menuItem;
  }

  async findByDomainStructuralSubtypeAndState(
    domain: DomainEnum,
    structuralSubtype: StructuralSubtypeEnum,
    state: StateEnum,
    includeArchived = false
  ): Promise<MenuItemDoc[]> {
    const filter: any = {
      domain,
      structuralSubtype,
      state,
    };

    if (!includeArchived) {
      filter.archived = false;
    }

    return await this.menuItemModel.find(filter).sort({ sortId: 1 }).exec();
  }

  async findByDomainAndStructuralSubtype(
    domain: DomainEnum,
    structuralSubtype: StructuralSubtypeEnum,
    includeArchived = false
  ): Promise<MenuItemDoc[]> {
    const filter: any = {
      domain,
      structuralSubtype,
    };

    if (!includeArchived) {
      filter.archived = false;
    }

    return await this.menuItemModel
      .find(filter)
      .sort({ state: 1, sortId: 1 })
      .exec();
  }

  async findByDomain(
    domain: DomainEnum,
    includeArchived = false
  ): Promise<MenuItemDoc[]> {
    const filter: any = { domain };

    if (!includeArchived) {
      filter.archived = false;
    }

    return await this.menuItemModel
      .find(filter)
      .sort({ structuralSubtype: 1, state: 1, sortId: 1 })
      .exec();
  }

  async update(
    id: string,
    updateMenuItemDto: UpdateMenuItemDto
  ): Promise<MenuItemDoc> {
    try {
      const updatedMenuItem = await this.menuItemModel
        .findByIdAndUpdate(
          id,
          { ...updateMenuItemDto, lastUpdated: new Date() },
          { new: true }
        )
        .exec();

      if (!updatedMenuItem) {
        throw new NotFoundException(`MenuItem with ID "${id}" not found`);
      }

      return updatedMenuItem;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException(
          'MenuItem with these properties already exists'
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.menuItemModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`MenuItem with ID "${id}" not found`);
    }
  }

  async archive(id: string): Promise<MenuItemDoc> {
    return await this.update(id, { archived: true });
  }

  async unarchive(id: string): Promise<MenuItemDoc> {
    return await this.update(id, { archived: false });
  }

  /**
   * Get the complete menu hierarchy for a specific domain
   */
  async getMenuHierarchy(
    domain: DomainEnum,
    includeArchived = false
  ): Promise<MenuHierarchyResponseDto> {
    const menuItems = await this.findByDomain(domain, includeArchived);

    const hierarchy: any = {
      domain,
      structuralSubtypes: {},
    };

    menuItems.forEach((item) => {
      if (!hierarchy.structuralSubtypes[item.structuralSubtype]) {
        hierarchy.structuralSubtypes[item.structuralSubtype] = {
          states: {},
        };
      }

      if (
        !hierarchy.structuralSubtypes[item.structuralSubtype].states[item.state]
      ) {
        hierarchy.structuralSubtypes[item.structuralSubtype].states[
          item.state
        ] = [];
      }

      hierarchy.structuralSubtypes[item.structuralSubtype].states[
        item.state
      ].push(item);
    });

    return hierarchy;
  }

  async reorderMenuItems(updateItem: SortMenuItemDto): Promise<MenuItemDoc> {
    this.logger.debug(
      `reorderMenuItems called with payload: ${JSON.stringify(updateItem)}`
    );
    const existing = await this.findOne(updateItem._id);
    if (!existing) {
      throw new NotFoundException(
        `MenuItem with ID "${updateItem._id}" not found`
      );
    }
    this.logger.debug(
      `Existing item before move: id=${existing._id?.toString?.()} parentId=${(existing as any).parentId?.toString?.()} sortId=${existing.sortId}`
    );

    // Ensure requested sort position is at least 1 (DTO allows 0)
    let requestedPosition = Math.max(1, Math.floor(updateItem.sortId));
    this.logger.debug(
      `Initial requested position (normalized) = ${requestedPosition}`
    );

    const parentChanged = existing.parentId !== updateItem.parentId;
    this.logger.debug(
      `Parent changed? ${parentChanged} (from=${(existing as any).parentId?.toString?.()} to=${updateItem.parentId})`
    );

    // Helper to build sibling filter respecting domain/subtype/state AND distinguishing root-level (no parent)
    const buildSiblingFilter = (parentId: any, excludeId: any) => {
      const base: any = {
        _id: { $ne: excludeId },
        domain: existing.domain,
        structuralSubtype: existing.structuralSubtype,
        state: existing.state,
      };
      if (parentId) {
        base.parentId = parentId;
        this.logger.debug(`Building sibling filter for parentId=${parentId}`);
      } else {
        // root-level: match docs with no parentId field OR null
        base.$or = [{ parentId: { $exists: false } }, { parentId: null }];
      }
      return base;
    };

    // 1. If parent changed, resequence OLD siblings first (closing the gap)
    if (parentChanged) {
      const oldSiblingsFilter = buildSiblingFilter(
        existing.parentId,
        existing._id
      );
      const oldSiblings = await this.menuItemModel
        .find(oldSiblingsFilter)
        .sort({ sortId: 1 })
        .exec();
      this.logger.debug(
        `Old siblings (excluding moving item) count=${oldSiblings.length}: ${oldSiblings.map((s) => `${s._id}:${s.sortId}`).join(', ')}`
      );

      if (oldSiblings.length) {
        const bulkOld = oldSiblings.map((doc, idx) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { sortId: idx + 1 } },
          },
        }));
        await this.menuItemModel.bulkWrite(bulkOld);
        this.logger.debug(
          `Old siblings resequenced. New order: ${oldSiblings.map((_, idx) => `${oldSiblings[idx]._id}:${idx + 1}`).join(', ')}`
        );
      }
    }

    // 2. Resequence NEW siblings (or same-parent siblings if parent not changed) inserting the moved item at requested position
    //    For same-parent reorders we exclude the moving item; for parent change it is already excluded naturally.
    const targetParentId = updateItem.parentId;
    const siblingFilter: any = buildSiblingFilter(targetParentId, existing._id);
    const siblings = await this.menuItemModel
      .find(siblingFilter)
      .sort({ sortId: 1 })
      .exec();
    this.logger.debug(
      `Target parent=${targetParentId} siblings pre-resequence count=${siblings.length}: ${siblings.map((s) => `${s._id}:${s.sortId}`).join(', ')}`
    );

    // Clamp requested position within [1, siblings.length + 1]
    if (requestedPosition > siblings.length + 1) {
      requestedPosition = siblings.length + 1;
    }
    this.logger.debug(`Clamped requested position = ${requestedPosition}`);

    // Build bulk operations assigning new contiguous sortIds including the moved item placeholder
    const bulkOps: any[] = [];
    let runningIndex = 1;
    for (const sib of siblings) {
      if (runningIndex === requestedPosition) {
        // reserve this spot for the moved item
        runningIndex++; // moved item will take (requestedPosition)
      }
      if (sib.sortId !== runningIndex) {
        bulkOps.push({
          updateOne: {
            filter: { _id: sib._id },
            update: { $set: { sortId: runningIndex } },
          },
        });
      }
      runningIndex++;
    }
    this.logger.debug(`Bulk ops to update siblings count=${bulkOps.length}`);

    if (bulkOps.length) {
      await this.menuItemModel.bulkWrite(bulkOps);
      const updatedSiblings = await this.menuItemModel
        .find(siblingFilter)
        .sort({ sortId: 1 })
        .exec();
      this.logger.debug(
        `Siblings after resequence (excluding moved item placeholder): ${updatedSiblings.map((s) => `${s._id}:${s.sortId}`).join(', ')}`
      );
    }

    // 3. Persist moved item with its new parent & sortId
    const existingId: string =
      (existing as any)._id?.toString() ?? (existing as any).id;
    this.logger.debug(
      `Persisting moved item id=${existingId} -> parentId=${updateItem.parentId} sortId=${requestedPosition}`
    );
    let updatedItem: MenuItemDoc | null = null;
    if (targetParentId) {
      updatedItem = await this.menuItemModel
        .findByIdAndUpdate(
          existingId,
          {
            $set: {
              parentId: targetParentId,
              sortId: requestedPosition,
              lastUpdated: new Date(),
            },
          },
          { new: true }
        )
        .exec();
    } else {
      // Moving to root: need to unset parentId explicitly
      updatedItem = await this.menuItemModel
        .findByIdAndUpdate(
          existingId,
          {
            $unset: { parentId: '' },
            $set: { sortId: requestedPosition, lastUpdated: new Date() },
          },
          { new: true }
        )
        .exec();
    }
    if (!updatedItem) {
      throw new NotFoundException(
        `MenuItem with ID "${existingId}" not found during final update`
      );
    }
    this.logger.debug(
      `Updated item result: id=${updatedItem._id?.toString?.()} parentId=${(updatedItem as any).parentId?.toString?.()} sortId=${updatedItem.sortId}`
    );

    return updatedItem;
  }
}
