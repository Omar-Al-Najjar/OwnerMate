import { NextResponse } from "next/server";
import {
  BackendRouteError,
  fetchBackendJson,
  getBackendAuthContext,
} from "@/lib/api/server";

type BackendSalesRecord = {
  id: string;
  record_date: string;
  revenue: number;
  orders: number;
  refund_count: number;
  refund_value: number;
  channel_revenue: Record<string, number>;
  products: Array<{
    id: string;
    label: string;
    category: "signature_drinks" | "desserts" | "breakfast" | "bundles";
    revenue: number;
    units: number;
  }>;
};

function buildDefaultProducts(revenue: number, orders: number) {
  const specs = [
    {
      id: "prod_signature",
      label: "Signature Drinks",
      category: "signature_drinks" as const,
      share: 0.34,
      unitPrice: 7,
    },
    {
      id: "prod_dessert",
      label: "Desserts",
      category: "desserts" as const,
      share: 0.18,
      unitPrice: 6,
    },
    {
      id: "prod_breakfast",
      label: "Breakfast",
      category: "breakfast" as const,
      share: 0.22,
      unitPrice: 8,
    },
    {
      id: "prod_bundle",
      label: "Bundles",
      category: "bundles" as const,
      share: 0.26,
      unitPrice: 18,
    },
  ];

  return specs.map((spec, index) => {
    const isLast = index === specs.length - 1;
    const productRevenue = isLast
      ? Math.max(
          0,
          revenue -
            specs
              .slice(0, -1)
              .reduce((sum, item) => sum + Math.round(revenue * item.share), 0)
        )
      : Math.round(revenue * spec.share);

    return {
      id: spec.id,
      label: spec.label,
      category: spec.category,
      revenue: productRevenue,
      units: Math.max(1, Math.round((orders * spec.share) / 1.2) || Math.round(productRevenue / spec.unitPrice)),
    };
  });
}

export async function GET() {
  try {
    const { businessId, headers } = await getBackendAuthContext();
    if (!businessId) {
      throw new BackendRouteError(
        "BUSINESS_NOT_FOUND",
        "No business is available for the authenticated user.",
        404
      );
    }

    const records = await fetchBackendJson<BackendSalesRecord[]>(
      `/sales/${businessId}`,
      { headers }
    );

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error) {
    if (error instanceof BackendRouteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load sales records.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      recordDate: string;
      revenue: number;
      orders: number;
      refundCount: number;
      refundValue: number;
      walkInRevenue: number;
      deliveryAppRevenue: number;
      instagramDmRevenue: number;
      whatsappRevenue: number;
    };
    const { businessId, headers } = await getBackendAuthContext();

    if (!businessId) {
      throw new BackendRouteError(
        "BUSINESS_NOT_FOUND",
        "No business is available for the authenticated user.",
        404
      );
    }

    const revenue = Number(payload.revenue) || 0;
    const orders = Number(payload.orders) || 0;

    const saved = await fetchBackendJson<BackendSalesRecord>("/sales/records", {
      method: "POST",
      headers,
      body: JSON.stringify({
        business_id: businessId,
        record_date: payload.recordDate,
        revenue,
        orders,
        refund_count: Number(payload.refundCount) || 0,
        refund_value: Number(payload.refundValue) || 0,
        channel_revenue: {
          walk_in: Number(payload.walkInRevenue) || 0,
          delivery_app: Number(payload.deliveryAppRevenue) || 0,
          instagram_dm: Number(payload.instagramDmRevenue) || 0,
          whatsapp: Number(payload.whatsappRevenue) || 0,
        },
        products: buildDefaultProducts(revenue, orders),
      }),
    });

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error) {
    if (error instanceof BackendRouteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save sales record.",
        },
      },
      { status: 500 }
    );
  }
}
