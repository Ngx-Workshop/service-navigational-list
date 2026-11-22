import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  CreateMenuItemDto,
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
import { MenuOrderingService } from './menu-ordering.service';
import { observeOperation } from '../observability/observability';

type MenuHierarchy = {
  domain: DomainEnum;
  structuralSubtypes: Partial<
    Record<
      StructuralSubtypeEnum,
      { states: Partial<Record<StateEnum, MenuItemDoc[]>> }
    >
  >;
};

function rethrowWriteError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  ) {
    throw new ConflictException(
      'MenuItem with these properties already exists'
    );
  }
  throw error;
}

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    @InjectModel(MenuItemDoc.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
    private readonly ordering: MenuOrderingService
  ) {}

  create(createMenuItemDto: CreateMenuItemDto): Promise<MenuItemDoc> {
    return observeOperation(this.logger, 'menu.create', async () => {
      try {
        const createMenuItem = new this.menuItemModel({
          ...createMenuItemDto,
          lastUpdated: new Date(),
        });
        return await createMenuItem.save();
      } catch (error: unknown) {
        rethrowWriteError(error);
      }
    });
  }

  async findAll(
    domain?: DomainEnum,
    structuralSubtype?: StructuralSubtypeEnum,
    state?: StateEnum,
    archived?: boolean,
    role?: RoleEnum
  ): Promise<MenuItemDoc[]> {
    const filter: FilterQuery<MenuItemDocument> = {};
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
    const filter: FilterQuery<MenuItemDocument> = {
      domain,
      structuralSubtype,
      state,
    };
    if (!includeArchived) filter.archived = false;
    return await this.menuItemModel.find(filter).sort({ sortId: 1 }).exec();
  }

  async findByDomainAndStructuralSubtype(
    domain: DomainEnum,
    structuralSubtype: StructuralSubtypeEnum,
    includeArchived = false
  ): Promise<MenuItemDoc[]> {
    const filter: FilterQuery<MenuItemDocument> = { domain, structuralSubtype };
    if (!includeArchived) filter.archived = false;
    return await this.menuItemModel
      .find(filter)
      .sort({ state: 1, sortId: 1 })
      .exec();
  }

  async findByDomain(
    domain: DomainEnum,
    includeArchived = false
  ): Promise<MenuItemDoc[]> {
    const filter: FilterQuery<MenuItemDocument> = { domain };
    if (!includeArchived) filter.archived = false;
    return await this.menuItemModel
      .find(filter)
      .sort({ structuralSubtype: 1, state: 1, sortId: 1 })
      .exec();
  }

  update(
    id: string,
    updateMenuItemDto: UpdateMenuItemDto
  ): Promise<MenuItemDoc> {
    return observeOperation(this.logger, 'menu.update', async () => {
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
      } catch (error: unknown) {
        rethrowWriteError(error);
      }
    });
  }

  remove(id: string): Promise<void> {
    return observeOperation(this.logger, 'menu.remove', async () => {
      const result = await this.menuItemModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new NotFoundException(`MenuItem with ID "${id}" not found`);
      }
    });
  }

  async archive(id: string): Promise<MenuItemDoc> {
    return await this.update(id, { archived: true });
  }

  async unarchive(id: string): Promise<MenuItemDoc> {
    return await this.update(id, { archived: false });
  }

  async getMenuHierarchy(
    domain: DomainEnum,
    includeArchived = false
  ): Promise<MenuHierarchy> {
    const menuItems = await this.findByDomain(domain, includeArchived);
    const hierarchy: MenuHierarchy = { domain, structuralSubtypes: {} };
    for (const item of menuItems) {
      const subtype = (hierarchy.structuralSubtypes[item.structuralSubtype] ??=
        {
          states: {},
        });
      (subtype.states[item.state] ??= []).push(item);
    }
    return hierarchy;
  }

  reorderMenuItems(updateItem: SortMenuItemDto): Promise<MenuItemDoc> {
    return observeOperation(this.logger, 'menu.reorder', () =>
      this.ordering.reorderMenuItems(updateItem)
    );
  }
}
