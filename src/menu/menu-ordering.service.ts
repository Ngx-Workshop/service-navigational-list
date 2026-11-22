import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, FilterQuery, Model, Types } from 'mongoose';
import { SortMenuItemDto } from './dto/menu-item.dto';
import { MenuItemDoc, MenuItemDocument } from './schemas/menu-item.schema';

@Injectable()
export class MenuOrderingService {
  constructor(
    @InjectModel(MenuItemDoc.name)
    private readonly menuItemModel: Model<MenuItemDocument>
  ) {}

  async reorderMenuItems(updateItem: SortMenuItemDto): Promise<MenuItemDoc> {
    const existing = await this.menuItemModel.findById(updateItem._id).exec();
    if (!existing) {
      throw new NotFoundException(
        `MenuItem with ID "${updateItem._id}" not found`
      );
    }
    let requestedPosition = Math.max(1, Math.floor(updateItem.sortId));
    // Preserve the existing ObjectId/string comparison and sequential write semantics.
    const parentChanged = existing.parentId !== updateItem.parentId;
    const buildSiblingFilter = (
      parentId: Types.ObjectId | string | undefined
    ): FilterQuery<MenuItemDocument> => {
      const filter: FilterQuery<MenuItemDocument> = {
        _id: { $ne: existing._id },
        domain: existing.domain,
        structuralSubtype: existing.structuralSubtype,
        state: existing.state,
      };
      if (parentId) filter.parentId = parentId;
      else filter.$or = [{ parentId: { $exists: false } }, { parentId: null }];
      return filter;
    };

    if (parentChanged) {
      const oldSiblings = await this.menuItemModel
        .find(buildSiblingFilter(existing.parentId))
        .sort({ sortId: 1 })
        .exec();
      if (oldSiblings.length) {
        await this.menuItemModel.bulkWrite(
          oldSiblings.map((doc, idx) => ({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { sortId: idx + 1 } },
            },
          }))
        );
      }
    }

    const targetParentId = updateItem.parentId;
    const siblingFilter = buildSiblingFilter(targetParentId);
    const siblings = await this.menuItemModel
      .find(siblingFilter)
      .sort({ sortId: 1 })
      .exec();
    requestedPosition = Math.min(requestedPosition, siblings.length + 1);
    const bulkOps: AnyBulkWriteOperation<MenuItemDocument>[] = [];
    let runningIndex = 1;
    for (const sibling of siblings) {
      if (runningIndex === requestedPosition) runningIndex++;
      if (sibling.sortId !== runningIndex) {
        bulkOps.push({
          updateOne: {
            filter: { _id: sibling._id },
            update: { $set: { sortId: runningIndex } },
          },
        });
      }
      runningIndex++;
    }
    if (bulkOps.length) {
      await this.menuItemModel.bulkWrite(bulkOps);
      // Retain the original post-write read and its failure semantics.
      await this.menuItemModel.find(siblingFilter).sort({ sortId: 1 }).exec();
    }

    const existingId = String(existing._id);
    const updatedItem = await this.menuItemModel
      .findByIdAndUpdate(
        existingId,
        targetParentId
          ? {
              $set: {
                parentId: targetParentId,
                sortId: requestedPosition,
                lastUpdated: new Date(),
              },
            }
          : {
              $unset: { parentId: '' },
              $set: { sortId: requestedPosition, lastUpdated: new Date() },
            },
        { new: true }
      )
      .exec();
    if (!updatedItem) {
      throw new NotFoundException(
        `MenuItem with ID "${existingId}" not found during final update`
      );
    }
    return updatedItem;
  }
}
