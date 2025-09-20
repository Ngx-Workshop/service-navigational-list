import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum DomainEnum {
  ADMIN = 'ADMIN',
  WORKSHOP = 'WORKSHOP',
}

export enum StructuralSubtypeEnum {
  HEADER = 'HEADER',
  NAV = 'NAV',
  FOOTER = 'FOOTER',
}

export enum StateEnum {
  FULL = 'FULL',
  RELAXED = 'RELAXED',
  COMPACT = 'COMPACT',
}

export interface MenuItem {
  // menu name
  menuItemText: string;
  // route path for the menu item
  routePath: string;
  // Short summary of the category item.
  tooltipText?: string;
  // Path to the SVG icon for the menu item buttons
  navSvgPath?: string;
  // Path to the SVG icon for the menu header
  headerSvgPath?: string;
  // Position of the doc item in the menu's list
  sortId: number;
  // Authentication required to view the menu
  authRequired?: boolean;
}

export type MenuItemDocument = MenuItemDoc & Document;

@Schema()
export class MenuItemDoc extends Document implements MenuItem {
  @Prop({ required: true })
  menuItemText: string;

  @Prop({ required: true })
  routePath: string;

  @Prop()
  tooltipText?: string;

  @Prop()
  navSvgPath?: string;

  @Prop()
  headerSvgPath?: string;

  @Prop({ required: true })
  sortId: number;

  @Prop({ default: false })
  authRequired?: boolean;

  // Hierarchy fields
  @Prop({ required: true, enum: DomainEnum })
  domain: DomainEnum;

  @Prop({ required: true, enum: StructuralSubtypeEnum })
  structuralSubtype: StructuralSubtypeEnum;

  @Prop({ required: true, enum: StateEnum })
  state: StateEnum;

  // Metadata fields
  @Prop({ default: 1 })
  version: number;

  @Prop({ default: 'No description provided' })
  description: string;

  @Prop({ default: Date.now })
  lastUpdated: Date;

  @Prop({ default: false })
  archived: boolean;
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItemDoc);

// Create compound index for efficient querying by domain, structural subtype, and state
MenuItemSchema.index({ domain: 1, structuralSubtype: 1, state: 1, sortId: 1 });

// Auto-increment version on updates
MenuItemSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  function () {
    const update = this.getUpdate() as any;
    if (update) {
      if (!update.$inc) {
        update.$inc = {};
      }
      update.$inc.version = 1;
    }
  }
);
