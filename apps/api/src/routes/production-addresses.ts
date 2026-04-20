import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appEnvironments, appProductionAddresses } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  productionAddressInputSchema,
  productionAddressSchema,
  productionAddressUpdateInputSchema,
  serializeProductionAddress,
} from "../lib/contracts.js";
import { invalidateDbOriginsCache } from "../lib/cors-origins.js";
import { AppError } from "../lib/errors.js";
import { bumpFlagsVersion } from "../lib/flag-versions.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { assertAppPermission } from "../lib/permissions.js";
import type { AppBindings } from "../lib/types.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const productionAddressParamsSchema = paramsSchema.extend({
  productionAddressId: z.string().uuid(),
});

const listProductionAddressesDataSchema = z.object({
  productionAddresses: z.array(productionAddressSchema),
});

const productionAddressDataSchema = z.object({
  productionAddress: productionAddressSchema,
});

const deleteProductionAddressDataSchema = z.object({
  deleted: z.literal(true),
});

const listProductionAddressesRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/production-addresses",
  tags: ["Production Addresses"],
  summary: "List app production addresses",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
  },
  responses: {
    200: successResponse(
      listProductionAddressesDataSchema,
      "App production addresses"
    ),
    ...defaultErrorResponses(),
  },
});

const createProductionAddressRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/production-addresses",
  tags: ["Production Addresses"],
  summary: "Create an app production address",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: productionAddressInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(
      productionAddressDataSchema,
      "Production address created"
    ),
    ...defaultErrorResponses(),
  },
});

const getProductionAddressRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/production-addresses/{productionAddressId}",
  tags: ["Production Addresses"],
  summary: "Get an app production address",
  security: [{ bearerAuth: [] }],
  request: {
    params: productionAddressParamsSchema,
  },
  responses: {
    200: successResponse(
      productionAddressDataSchema,
      "Production address details"
    ),
    ...defaultErrorResponses(),
  },
});

const updateProductionAddressRoute = createRoute({
  method: "patch",
  path: "/api/v1/apps/{appId}/production-addresses/{productionAddressId}",
  tags: ["Production Addresses"],
  summary: "Update an app production address",
  security: [{ bearerAuth: [] }],
  request: {
    params: productionAddressParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: productionAddressUpdateInputSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(
      productionAddressDataSchema,
      "Production address updated"
    ),
    ...defaultErrorResponses(),
  },
});

const deleteProductionAddressRoute = createRoute({
  method: "delete",
  path: "/api/v1/apps/{appId}/production-addresses/{productionAddressId}",
  tags: ["Production Addresses"],
  summary: "Delete an app production address",
  security: [{ bearerAuth: [] }],
  request: {
    params: productionAddressParamsSchema,
  },
  responses: {
    200: successResponse(
      deleteProductionAddressDataSchema,
      "Production address deleted"
    ),
    ...defaultErrorResponses(),
  },
});

async function getProductionAddressOrThrow(
  appId: string,
  productionAddressId: string
) {
  const productionAddress = await db.query.appProductionAddresses.findFirst({
    where: and(
      eq(appProductionAddresses.appId, appId),
      eq(appProductionAddresses.id, productionAddressId)
    ),
  });

  if (!productionAddress) {
    throw new AppError(
      404,
      "PRODUCTION_ADDRESS_NOT_FOUND",
      "App production address not found"
    );
  }

  return productionAddress;
}

async function upsertProductionEnvironment(
  tx: DbTransaction,
  input: {
    appId: string;
    previousLabel?: string;
    label: string;
    address: string;
  }
) {
  const existing = await tx.query.appEnvironments.findFirst({
    where: (environment, { and, eq }) =>
      and(
        eq(environment.appId, input.appId),
        eq(environment.name, input.previousLabel ?? input.label)
      ),
  });

  if (existing) {
    await tx
      .update(appEnvironments)
      .set({
        name: input.label,
        address: input.address,
      })
      .where(eq(appEnvironments.id, existing.id));
    return;
  }

  const lastEnvironment = await tx.query.appEnvironments.findFirst({
    where: (environment, { eq }) => eq(environment.appId, input.appId),
    orderBy: (environment, { desc }) => [desc(environment.position)],
  });

  await tx.insert(appEnvironments).values({
    appId: input.appId,
    name: input.label,
    address: input.address,
    enabled: true,
    position: (lastEnvironment?.position ?? -1) + 1,
  });
}

export function registerProductionAddressRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listProductionAddressesRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());
    const productionAddresses = await db
      .select()
      .from(appProductionAddresses)
      .where(eq(appProductionAddresses.appId, params.appId))
      .orderBy(asc(appProductionAddresses.label));

    return jsonSuccess(c, {
      productionAddresses: productionAddresses.map(serializeProductionAddress),
    });
  });

  openapi(createProductionAddressRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, productionAddressInputSchema);

    const productionAddress = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(appProductionAddresses)
        .values({
          appId: params.appId,
          label: body.label,
          address: body.address,
        })
        .returning();

      if (!created) {
        throw new Error("Production address insert returned no row");
      }

      await upsertProductionEnvironment(tx, {
        appId: params.appId,
        label: body.label,
        address: body.address,
      });

      return created;
    });

    if (!productionAddress) {
      throw new Error("Production address insert returned no row");
    }

    invalidateDbOriginsCache();
    await bumpFlagsVersion(params.appId, null);

    return jsonSuccess(
      c,
      {
        productionAddress: serializeProductionAddress(productionAddress),
      },
      201
    );
  });

  openapi(getProductionAddressRoute, async (c) => {
    const params = productionAddressParamsSchema.parse(c.req.param());
    const productionAddress = await getProductionAddressOrThrow(
      params.appId,
      params.productionAddressId
    );

    return jsonSuccess(c, {
      productionAddress: serializeProductionAddress(productionAddress),
    });
  });

  openapi(updateProductionAddressRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = productionAddressParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, productionAddressUpdateInputSchema);

    const existing = await getProductionAddressOrThrow(
      params.appId,
      params.productionAddressId
    );

    const productionAddress = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(appProductionAddresses)
        .set({
          ...(body.label === undefined ? {} : { label: body.label }),
          ...(body.address === undefined ? {} : { address: body.address }),
        })
        .where(
          and(
            eq(appProductionAddresses.appId, params.appId),
            eq(appProductionAddresses.id, params.productionAddressId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error("Production address update returned no row");
      }

      await upsertProductionEnvironment(tx, {
        appId: params.appId,
        previousLabel: existing.label,
        label: updated.label,
        address: updated.address,
      });

      return updated;
    });

    if (!productionAddress) {
      throw new Error("Production address update returned no row");
    }

    invalidateDbOriginsCache();
    await bumpFlagsVersion(params.appId, null);

    return jsonSuccess(c, {
      productionAddress: serializeProductionAddress(productionAddress),
    });
  });

  openapi(deleteProductionAddressRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = productionAddressParamsSchema.parse(c.req.param());

    const productionAddress = await getProductionAddressOrThrow(
      params.appId,
      params.productionAddressId
    );

    await db.transaction(async (tx) => {
      await tx
        .delete(appProductionAddresses)
        .where(
          and(
            eq(appProductionAddresses.appId, params.appId),
            eq(appProductionAddresses.id, params.productionAddressId)
          )
        );

      await tx
        .delete(appEnvironments)
        .where(
          and(
            eq(appEnvironments.appId, params.appId),
            eq(appEnvironments.name, productionAddress.label)
          )
        );
    });

    invalidateDbOriginsCache();
    await bumpFlagsVersion(params.appId, null);

    return jsonSuccess(c, {
      deleted: true as const,
    });
  });
}
