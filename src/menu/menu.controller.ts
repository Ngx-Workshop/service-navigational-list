import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateMenuItemDto,
  MenuHierarchyResponseDto,
  MenuItemDto,
  UpdateMenuItemDto,
} from './dto/menu-item.dto';
import { MenuService } from './menu.service';
import {
  DomainEnum,
  StateEnum,
  StructuralSubtypeEnum,
} from './schemas/menu-item.schema';

@ApiTags('Menu')
@Controller('navigational-list')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @ApiCreatedResponse({ type: MenuItemDto })
  create(@Body() createMenuItemDto: CreateMenuItemDto) {
    return this.menuService.create(createMenuItemDto);
  }

  @Get()
  @ApiQuery({
    name: 'domain',
    required: false,
    enum: DomainEnum,
    description: 'Filter by domain',
  })
  @ApiQuery({
    name: 'structuralSubtype',
    required: false,
    enum: StructuralSubtypeEnum,
    description: 'Filter by structural subtype',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: StateEnum,
    description: 'Filter by state',
  })
  @ApiQuery({
    name: 'archived',
    required: false,
    type: Boolean,
    description: 'Filter by archived status',
  })
  @ApiQuery({
    name: 'authRequired',
    required: false,
    type: Boolean,
    description: 'Filter by authentication requirement',
  })
  @ApiOkResponse({ type: MenuItemDto, isArray: true })
  findAll(
    @Query('domain') domain?: DomainEnum,
    @Query('structuralSubtype') structuralSubtype?: StructuralSubtypeEnum,
    @Query('state') state?: StateEnum,
    @Query('archived') archived?: string,
    @Query('authRequired') authRequired?: string
  ) {
    const archivedFilter =
      archived === 'true' ? true : archived === 'false' ? false : undefined;
    const authRequiredFilter =
      authRequired === 'true'
        ? true
        : authRequired === 'false'
          ? false
          : undefined;

    return this.menuService.findAll(
      domain,
      structuralSubtype,
      state,
      archivedFilter,
      authRequiredFilter
    );
  }

  @Get('hierarchy/:domain')
  @ApiParam({ name: 'domain', enum: DomainEnum })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include archived menu items',
  })
  @ApiOkResponse({
    type: MenuHierarchyResponseDto,
    description: 'Complete menu hierarchy for the domain',
  })
  getMenuHierarchy(
    @Param('domain') domain: DomainEnum,
    @Query('includeArchived') includeArchived?: string
  ) {
    const includeArchivedBool = includeArchived === 'true';
    return this.menuService.getMenuHierarchy(domain, includeArchivedBool);
  }

  @Get('domain/:domain')
  @ApiParam({ name: 'domain', enum: DomainEnum })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include archived menu items',
  })
  @ApiOkResponse({ type: MenuItemDto, isArray: true })
  findByDomain(
    @Param('domain') domain: DomainEnum,
    @Query('includeArchived') includeArchived?: string
  ) {
    const includeArchivedBool = includeArchived === 'true';
    return this.menuService.findByDomain(domain, includeArchivedBool);
  }

  @Get('domain/:domain/structural-subtype/:structuralSubtype')
  @ApiParam({ name: 'domain', enum: DomainEnum })
  @ApiParam({ name: 'structuralSubtype', enum: StructuralSubtypeEnum })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include archived menu items',
  })
  @ApiOkResponse({ type: MenuItemDto, isArray: true })
  findByDomainAndStructuralSubtype(
    @Param('domain') domain: DomainEnum,
    @Param('structuralSubtype') structuralSubtype: StructuralSubtypeEnum,
    @Query('includeArchived') includeArchived?: string
  ) {
    const includeArchivedBool = includeArchived === 'true';
    return this.menuService.findByDomainAndStructuralSubtype(
      domain,
      structuralSubtype,
      includeArchivedBool
    );
  }

  @Get('domain/:domain/structural-subtype/:structuralSubtype/state/:state')
  @ApiParam({ name: 'domain', enum: DomainEnum })
  @ApiParam({ name: 'structuralSubtype', enum: StructuralSubtypeEnum })
  @ApiParam({ name: 'state', enum: StateEnum })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include archived menu items',
  })
  @ApiOkResponse({ type: MenuItemDto, isArray: true })
  findByDomainStructuralSubtypeAndState(
    @Param('domain') domain: DomainEnum,
    @Param('structuralSubtype') structuralSubtype: StructuralSubtypeEnum,
    @Param('state') state: StateEnum,
    @Query('includeArchived') includeArchived?: string
  ) {
    const includeArchivedBool = includeArchived === 'true';
    return this.menuService.findByDomainStructuralSubtypeAndState(
      domain,
      structuralSubtype,
      state,
      includeArchivedBool
    );
  }

  @Post('sort/:id')
  @ApiParam({ name: 'id', description: 'Menu item ID to reposition' })
  @ApiBody({ type: MenuItemDto })
  @ApiOkResponse({ type: MenuItemDto })
  reorderMenuItems(@Body() menuItemDto: MenuItemDto) {
    return this.menuService.reorderMenuItems(menuItemDto._id);
  }

  @Get(':id')
  @ApiOkResponse({ type: MenuItemDto })
  findOne(@Param('id') id: string) {
    return this.menuService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: MenuItemDto })
  update(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto
  ) {
    return this.menuService.update(id, updateMenuItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }

  @Patch(':id/archive')
  @ApiOkResponse({ type: MenuItemDto })
  archive(@Param('id') id: string) {
    return this.menuService.archive(id);
  }

  @Patch(':id/unarchive')
  @ApiOkResponse({ type: MenuItemDto })
  unarchive(@Param('id') id: string) {
    return this.menuService.unarchive(id);
  }
}
