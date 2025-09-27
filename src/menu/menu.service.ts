import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { lastValueFrom, of } from 'rxjs';
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
  StateEnum,
  StructuralSubtypeEnum,
} from './schemas/menu-item.schema';

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(MenuItemDoc.name)
    private menuItemModel: Model<MenuItemDocument>
  ) {}

  async authTest(): Promise<{ message: string }> {
    return lastValueFrom(
      of({ message: 'Authentication successful Menu Service' })
    );
  }

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
    authRequired?: boolean
  ): Promise<MenuItemDoc[]> {
    const filter: any = {};

    if (domain !== undefined) filter.domain = domain;
    if (structuralSubtype !== undefined)
      filter.structuralSubtype = structuralSubtype;
    if (state !== undefined) filter.state = state;
    if (archived !== undefined) filter.archived = archived;
    if (authRequired !== undefined) filter.authRequired = authRequired;

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
    const existing = await this.findOne(updateItem._id);
    if (!existing) {
      throw new NotFoundException(
        `MenuItem with ID "${updateItem._id}" not found`
      );
    }

    // Ensure requested sort position is at least 1 (DTO allows 0)
    let requestedPosition = Math.max(1, Math.floor(updateItem.sortId));

    const parentChanged = existing.parentId !== updateItem.parentId;

    // 1. If parent changed, resequence OLD siblings first (closing the gap)
    if (parentChanged) {
      const oldSiblings = await this.menuItemModel
        .find({ parentId: existing.parentId, _id: { $ne: existing._id } })
        .sort({ sortId: 1 })
        .exec();

      if (oldSiblings.length) {
        const bulkOld = oldSiblings.map((doc, idx) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { sortId: idx + 1 } },
          },
        }));
        await this.menuItemModel.bulkWrite(bulkOld);
      }
    }

    // 2. Resequence NEW siblings (or same-parent siblings if parent not changed) inserting the moved item at requested position
    //    For same-parent reorders we exclude the moving item; for parent change it is already excluded naturally.
    const targetParentId = updateItem.parentId;
    const siblingFilter: any = {
      parentId: targetParentId,
      _id: { $ne: existing._id },
    };
    const siblings = await this.menuItemModel
      .find(siblingFilter)
      .sort({ sortId: 1 })
      .exec();

    // Clamp requested position within [1, siblings.length + 1]
    if (requestedPosition > siblings.length + 1) {
      requestedPosition = siblings.length + 1;
    }

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

    if (bulkOps.length) {
      await this.menuItemModel.bulkWrite(bulkOps);
    }

    // 3. Persist moved item with its new parent & sortId
    const existingId: string =
      (existing as any)._id?.toString() ?? (existing as any).id;
    const updatedItem = await this.update(existingId, {
      parentId: targetParentId,
      sortId: requestedPosition,
    });

    return updatedItem;
  }
}
