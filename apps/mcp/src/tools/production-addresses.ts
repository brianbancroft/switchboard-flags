import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerReadTool, registerWriteTool } from "../lib/register.js";
import {
  appAddressSchema,
  appRefSchema,
  writeApprovalSchema,
} from "../lib/schemas.js";

const productionAddressRefSchema = appRefSchema
  .extend({
    productionAddressId: z.string().uuid().optional(),
    productionAddressLabel: z.string().min(1).max(120).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.productionAddressId || value.productionAddressLabel),
    {
      message: "Provide productionAddressId or productionAddressLabel",
      path: ["productionAddressLabel"],
    }
  );

export function registerProductionAddressTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "list_production_addresses",
    "List the registered production addresses for an app.",
    appRefSchema,
    async (input) => {
      const app = await backend.resolveApp(input);
      const result = await backend.listProductionAddresses(app.id);
      return {
        app,
        productionAddresses: result.productionAddresses,
      };
    }
  );

  registerWriteTool(
    server,
    "create_production_address",
    "Create a production address with a label and exact URL after explicit user approval.",
    appRefSchema.extend({
      label: z.string().min(1).max(120),
      address: appAddressSchema,
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: false,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      return backend.createProductionAddress(app.id, {
        label: input.label,
        address: input.address,
      });
    }
  );

  registerWriteTool(
    server,
    "update_production_address",
    "Update a production address after explicit user approval.",
    productionAddressRefSchema.extend({
      label: z.string().min(1).max(120).optional(),
      address: appAddressSchema.optional(),
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      const productionAddress = await backend.resolveProductionAddress({
        app,
        productionAddressId: input.productionAddressId,
        label: input.productionAddressLabel,
      });

      return backend.updateProductionAddress(app.id, productionAddress.id, {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.address === undefined ? {} : { address: input.address }),
      });
    }
  );

  registerWriteTool(
    server,
    "delete_production_address",
    "Delete a production address after explicit user approval.",
    productionAddressRefSchema.extend({
      approval: writeApprovalSchema,
    }),
    {
      destructiveHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      const productionAddress = await backend.resolveProductionAddress({
        app,
        productionAddressId: input.productionAddressId,
        label: input.productionAddressLabel,
      });

      return backend.deleteProductionAddress(app.id, productionAddress.id);
    }
  );
}
