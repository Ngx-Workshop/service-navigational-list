import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { NgxAuthClientModule, RemoteAuthGuard } from '@tmdjr/ngx-auth-client';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuItemDoc, MenuItemSchema } from './schemas/menu-item.schema';

const SCHEMA_IMPORTS =
  process.env.GENERATE_OPENAPI === 'true'
    ? []
    : [
        MongooseModule.forFeature([
          { name: MenuItemDoc.name, schema: MenuItemSchema },
        ]),
      ];

// When generating OpenAPI, stub out the Mongoose model and the guard
const FAKE_PROVIDERS =
  process.env.GENERATE_OPENAPI === 'true'
    ? [
        {
          provide: getModelToken(MenuItemDoc.name),
          // Minimal fake the service can accept; if service calls methods during generation (it shouldn't), add no-op fns
          useValue: {
            // common Mongoose methods we might accidentally touch
            find: () => ({
              exec: async () => [],
              sort: () => ({ exec: async () => [] }),
            }),
            findById: () => ({ exec: async () => null }),
            findByIdAndUpdate: () => ({ exec: async () => null }),
            findOne: () => ({ exec: async () => null }),
            findByIdAndDelete: () => ({ exec: async () => null }),
            bulkWrite: async () => ({}),
          },
        },
        {
          // In case the guard has runtime deps — make it a no-op
          provide: RemoteAuthGuard,
          useValue: { canActivate: () => true },
        },
      ]
    : [];

@Module({
  imports: [NgxAuthClientModule, ...SCHEMA_IMPORTS],
  controllers: [MenuController],
  providers: [MenuService, ...FAKE_PROVIDERS],
  exports: [MenuService],
})
export class MenuModule {}
