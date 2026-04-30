import { getDashboardPayload } from "@/lib/dashboard/derive";
import type {
  DashboardPayload,
  SalesChannelId,
  SalesProductCategory,
  SalesRecord,
} from "@/types/dashboard";
import type { Review } from "@/types/review";
import type { SettingsPayload } from "@/types/settings";

const reviewSeed: Review[] = [
  {
    id: "rev_003",
    source: "Facebook",
    rating: 2,
    language: "en",
    reviewerName: "Marcus Chen",
    reviewText:
      "The final result was okay, but the initial communication was unclear.",
    reviewCreatedAt: "2026-03-18T15:45:00.000Z",
    status: "reviewed",
    sentiment: {
      label: "negative",
      confidence: 0.88,
      summaryTags: ["communication"],
    },
  },
  {
    id: "rev_004",
    source: "Google Business",
    rating: 4,
    language: "ar",
    reviewerName: "مها خالد",
    reviewText: "الخدمة مرتبة وسريعة لكن أحتاج وضوحا أكثر في تفاصيل المتابعة.",
    reviewCreatedAt: "2026-03-21T08:20:00.000Z",
    status: "new",
    sentiment: {
      label: "positive",
      confidence: 0.83,
      summaryTags: ["clarity", "service"],
    },
  },
  {
    id: "rev_005",
    source: "WhatsApp",
    rating: 5,
    language: "en",
    reviewerName: "Noah Patel",
    reviewText:
      "Fast turnaround and a very clear response. I would definitely use this again.",
    reviewCreatedAt: "2026-03-21T06:50:00.000Z",
    status: "reviewed",
    sentiment: {
      label: "positive",
      confidence: 0.92,
      summaryTags: ["speed", "clarity"],
    },
  },
  {
    id: "rev_006",
    source: "X",
    rating: 3,
    language: "en",
    reviewerName: "Amelia Ross",
    reviewText:
      "The result was acceptable, but the experience still feels average overall.",
    reviewCreatedAt: "2026-03-17T18:15:00.000Z",
    status: "new",
    sentiment: {
      label: "neutral",
      confidence: 0.68,
      summaryTags: ["experience"],
    },
  },
  {
    id: "rev_007",
    source: "Instagram",
    rating: 1,
    language: "ar",
    reviewerName: "سارة يوسف",
    reviewText: "الرد كان متأخرا جدا ولم أصل إلى النتيجة التي توقعتها.",
    reviewCreatedAt: "2026-03-16T11:40:00.000Z",
    status: "reviewed",
    sentiment: {
      label: "negative",
      confidence: 0.95,
      summaryTags: ["delay", "expectations"],
    },
  },
  {
    id: "rev_008",
    source: "Google Business",
    rating: 4,
    language: "en",
    reviewerName: "Olivia Brown",
    reviewText:
      "Easy to work with and the final delivery matched what I needed.",
    reviewCreatedAt: "2026-03-15T14:05:00.000Z",
    status: "reviewed",
    sentiment: {
      label: "positive",
      confidence: 0.9,
      summaryTags: ["delivery", "quality"],
    },
  },
  {
    id: "rev_009",
    source: "Facebook",
    rating: 2,
    language: "en",
    reviewerName: "Daniel Kim",
    reviewText:
      "Support eventually helped, but I had to follow up more than once.",
    reviewCreatedAt: "2026-03-14T10:25:00.000Z",
    status: "new",
    sentiment: {
      label: "negative",
      confidence: 0.81,
      summaryTags: ["support", "follow-up"],
    },
  },
  {
    id: "rev_010",
    source: "WhatsApp",
    rating: 4,
    language: "ar",
    reviewerName: "عمر حمدان",
    reviewText:
      "الخدمة جيدة والتنفيذ سريع لكن أحتاج تنسيقا أفضل في الرسائل القادمة.",
    reviewCreatedAt: "2026-03-13T09:10:00.000Z",
    status: "reviewed",
    sentiment: {
      label: "neutral",
      confidence: 0.66,
      summaryTags: ["messaging", "speed"],
    },
  },
];

const salesChannelBaseShares: Record<SalesChannelId, number> = {
  walk_in: 0.29,
  delivery_app: 0.35,
  instagram_dm: 0.16,
  whatsapp: 0.2,
};

const productCatalog: Array<{
  id: string;
  label: string;
  category: SalesProductCategory;
  share: number;
  unitPrice: number;
}> = [
  {
    id: "prod_spanish_latte",
    label: "Spanish Latte",
    category: "signature_drinks",
    share: 0.28,
    unitPrice: 6.5,
  },
  {
    id: "prod_date_cake",
    label: "Date Cake",
    category: "desserts",
    share: 0.22,
    unitPrice: 5.25,
  },
  {
    id: "prod_breakfast_wrap",
    label: "Breakfast Wrap",
    category: "breakfast",
    share: 0.24,
    unitPrice: 7.8,
  },
  {
    id: "prod_ramadan_bundle",
    label: "Family Bundle",
    category: "bundles",
    share: 0.26,
    unitPrice: 18.5,
  },
];

function generateSalesSeed(): SalesRecord[] {
  const latestDate = new Date("2026-03-21T00:00:00.000Z");
  const weekdayRevenueFactors = [1.02, 1.08, 1.11, 1.18, 1.26, 1.38, 1.22];
  const weekdayOrderFactors = [1.0, 1.04, 1.07, 1.13, 1.2, 1.33, 1.18];

  return Array.from({ length: 45 }, (_, index) => {
    const date = new Date(latestDate);
    date.setUTCDate(latestDate.getUTCDate() - (44 - index));

    const weekday = date.getUTCDay();
    const weekFactor = weekdayRevenueFactors[weekday];
    const orderFactor = weekdayOrderFactors[weekday];
    const seasonalLift = 1 + ((index % 9) - 4) * 0.012;
    const orders = Math.round((42 + (index % 5) * 3) * orderFactor);
    const averageOrderValue = 19.5 + (index % 6) * 0.65 + (weekday >= 4 ? 1.8 : 0);
    const revenue = Math.round(orders * averageOrderValue * weekFactor * seasonalLift);
    const refundCount = index % 10 === 0 ? 3 : index % 4 === 0 ? 2 : 1;
    const refundValue = Math.round(refundCount * (8 + (index % 3) * 2.5));

    const walkInRevenue = Math.round(
      revenue * (salesChannelBaseShares.walk_in + ((index % 3) - 1) * 0.018)
    );
    const deliveryRevenue = Math.round(
      revenue * (salesChannelBaseShares.delivery_app + ((index % 4) - 1.5) * 0.015)
    );
    const instagramRevenue = Math.round(
      revenue * (salesChannelBaseShares.instagram_dm + ((index % 5) - 2) * 0.01)
    );
    const whatsappRevenue = Math.max(
      0,
      revenue - walkInRevenue - deliveryRevenue - instagramRevenue
    );

    const products = productCatalog.map((product, productIndex, productList) => {
      const isLast = productIndex === productList.length - 1;
      const rawRevenue = isLast
        ? 0
        : Math.round(
            revenue *
              (product.share + (((index + productIndex) % 4) - 1.5) * 0.015)
          );
      return {
        id: product.id,
        label: product.label,
        category: product.category,
        revenue: rawRevenue,
        units: 0,
      };
    });

    const assignedRevenue = products
      .slice(0, -1)
      .reduce((sum, product) => sum + product.revenue, 0);
    products[products.length - 1].revenue = Math.max(0, revenue - assignedRevenue);
    products.forEach((product, productIndex) => {
      const unitPrice = productCatalog[productIndex].unitPrice;
      product.units = Math.max(4, Math.round(product.revenue / unitPrice));
    });

    return {
      date: date.toISOString(),
      revenue,
      orders,
      refundCount,
      refundValue,
      channelRevenue: {
        walk_in: walkInRevenue,
        delivery_app: deliveryRevenue,
        instagram_dm: instagramRevenue,
        whatsapp: whatsappRevenue,
      },
      products,
    };
  });
}

export function getReviews(): Review[] {
  return [...reviewSeed].sort(
    (left, right) =>
      new Date(right.reviewCreatedAt).getTime() -
      new Date(left.reviewCreatedAt).getTime()
  );
}

export function getReviewById(reviewId: string): Review | undefined {
  return getReviews().find((review) => review.id === reviewId);
}

export function getRecentReviews(limit = 4): Review[] {
  return getReviews().slice(0, limit);
}

export function getSalesRecords(): SalesRecord[] {
  return generateSalesSeed();
}

export const reviews: Review[] = getReviews();
export const recentReviews: Review[] = getRecentReviews();
export const dashboardData: DashboardPayload = getDashboardPayload(
  reviews,
  getSalesRecords()
);

export function getDashboardData(): DashboardPayload {
  return getDashboardPayload(getReviews(), getSalesRecords());
}

export const settingsProfile: SettingsPayload = {
  locale: "en",
  theme: "system",
  profile: {
    fullName: "OwnerMate User",
    email: "user@ownermate.local",
    role: "Business Owner",
  },
  business: {
    id: "business_mock_001",
    name: "OwnerMate Demo Business",
    googleReviewBusinessName: "",
  },
};
