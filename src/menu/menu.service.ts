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

  /**
   * Reorder menu items within a specific domain, structural subtype, and state
   */
  async reorderMenuItems(updateItem: SortMenuItemDto): Promise<MenuItemDoc> {
    const previousItem = await this.findOne(updateItem._id);
    if (!previousItem) {
      throw new NotFoundException(
        `MenuItem with ID "${updateItem._id}" not found`
      );
    }
    // If the parent id is unchanged no need to reorder previous siblings sortIds
    // It parent id has changed, reorder previous siblings and new siblings sortIds
    // No need to even check if Domain Subtype or State has changed, it won't matter
    if (previousItem.parentId !== updateItem.parentId) {
      // Reorder previous siblings
      const previousSiblings = await this.menuItemModel
        .find({
          parentId: previousItem.parentId,
          domain: previousItem.domain,
          structuralSubtype: previousItem.structuralSubtype,
          state: previousItem.state,
          _id: { $ne: previousItem._id },
        })
        .sort({ sortId: 1 })
        .exec();

      for (let i = 0; i < previousSiblings.length; i++) {
        previousSiblings[i].sortId = i + 1;
        await previousSiblings[i].save();
      }

      // Reorder new siblings
      const newSiblings = await this.menuItemModel
        .find({
          parentId: updateItem.parentId,
          _id: { $ne: updateItem._id },
        })
        .sort({ sortId: 1 })
        .exec();

      // Insert the updated item into the correct position based on its sortId
      let inserted = false;
      for (let i = 0; i < newSiblings.length; i++) {
        if (!inserted && updateItem.sortId <= newSiblings[i].sortId) {
          updateItem.sortId = i + 1;
          inserted = true;
        }
        newSiblings[i].sortId = inserted ? i + 2 : i + 1;
        await newSiblings[i].save();
      }

      // If not yet inserted, it goes to the end
      if (!inserted) {
        updateItem.sortId = newSiblings.length + 1;
      }
    }

    // Finally update the moved item
    const updatedItem = await this.update(updateItem._id, {
      parentId: updateItem.parentId,
      sortId: updateItem.sortId,
    });

    return updatedItem;
  }
}
