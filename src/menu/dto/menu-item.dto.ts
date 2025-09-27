import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  DomainEnum,
  StateEnum,
  StructuralSubtypeEnum,
} from '../schemas/menu-item.schema';

/**
 * READ/Response DTO for a single MenuItemDoc
 */
export class MenuItemDto {
  @ApiProperty() _id: string;

  @ApiProperty() menuItemText: string;

  @ApiProperty() routePath: string;

  @ApiPropertyOptional() tooltipText?: string;

  @ApiPropertyOptional() navSvgPath?: string;

  @ApiPropertyOptional() headerSvgPath?: string;

  @ApiProperty() sortId: number;

  @ApiProperty() authRequired: boolean;

  @ApiProperty({ enum: DomainEnum })
  domain: DomainEnum;

  @ApiProperty({ enum: StructuralSubtypeEnum })
  structuralSubtype: StructuralSubtypeEnum;

  @ApiProperty({ enum: StateEnum })
  state: StateEnum;

  @ApiProperty() version: number;

  @ApiProperty() description: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastUpdated: string;

  @ApiProperty() archived: boolean;

  @ApiProperty() __v: number;

  @ApiPropertyOptional({
    description: 'Parent menu item ID for hierarchical navigation',
  })
  parentId?: string;
}

/**
 * CREATE DTO – only user-supplied fields (version & timestamps are handled by the model)
 */
export class CreateMenuItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  menuItemText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  routePath: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tooltipText?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  navSvgPath?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  headerSvgPath?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  sortId: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  authRequired?: boolean;

  @ApiProperty({ enum: DomainEnum })
  @IsEnum(DomainEnum)
  @IsNotEmpty()
  domain: DomainEnum;

  @ApiProperty({ enum: StructuralSubtypeEnum })
  @IsEnum(StructuralSubtypeEnum)
  @IsNotEmpty()
  structuralSubtype: StructuralSubtypeEnum;

  @ApiProperty({ enum: StateEnum })
  @IsEnum(StateEnum)
  @IsNotEmpty()
  state: StateEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  archived?: boolean;

  @ApiPropertyOptional({
    description: 'Parent menu item ID for hierarchical navigation',
  })
  @IsMongoId()
  @IsOptional()
  parentId?: string;

  // Expose in case clients want to explicitly set it; otherwise schema default (Date.now) applies
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDateString()
  @IsOptional()
  lastUpdated?: string;
}

/**
 * UPDATE DTO – Partial of Create DTO
 */
export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}

/**
 * Query parameters for filtering menu items
 */
export class MenuQueryDto {
  @ApiPropertyOptional({ enum: DomainEnum })
  @IsEnum(DomainEnum)
  @IsOptional()
  domain?: DomainEnum;

  @ApiPropertyOptional({ enum: StructuralSubtypeEnum })
  @IsEnum(StructuralSubtypeEnum)
  @IsOptional()
  structuralSubtype?: StructuralSubtypeEnum;

  @ApiPropertyOptional({ enum: StateEnum })
  @IsEnum(StateEnum)
  @IsOptional()
  state?: StateEnum;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  archived?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  authRequired?: boolean;
}
