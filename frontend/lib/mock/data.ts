import type { GeneratedContentDraft, GenerationMode } from "@/types/content";
import type { DashboardMetric } from "@/types/dashboard";
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

export function getDashboardMetrics(): DashboardMetric[] {
  const items = getReviews();
  const totalReviews = items.length || 1;
  const positiveCount = items.filter(
    (review) => review.sentiment.label === "positive"
  ).length;
  const averageRating =
    items.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

  return [
    {
      id: "total-reviews",
      label: "Total reviews",
      value: String(items.length),
      helper: `${items.filter((review) => review.status === "new").length} new`,
    },
    {
      id: "avg-rating",
      label: "Average rating",
      value: averageRating.toFixed(1),
      helper: `${items.length} reviews`,
    },
    {
      id: "positive-share",
      label: "Positive sentiment",
      value: `${Math.round((positiveCount / totalReviews) * 100)}%`,
      helper: `${positiveCount} positive`,
    },
  ];
}

export const reviews: Review[] = getReviews();
export const dashboardMetrics: DashboardMetric[] = getDashboardMetrics();
export const recentReviews: Review[] = getRecentReviews();

export const contentModes: Array<{ label: string; value: GenerationMode }> = [
  { label: "Marketing content generation", value: "marketing_content" },
];

export const generatedDraft: GeneratedContentDraft = {
  id: "draft_001",
  mode: "marketing_content",
  language: "en",
  generatedText:
    "Discover a practical workspace that helps you manage reviews and create clear content for your business.",
  editableText:
    "Discover a practical workspace that helps you manage reviews and create clear content for your business.",
};

export const settingsProfile: SettingsPayload = {
  locale: "en",
  theme: "system",
  profile: {
    fullName: "OwnerMate Admin",
    email: "admin@ownermate.local",
    role: "Business Owner",
  },
};
