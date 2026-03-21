export type ReviewLanguage = "en" | "ar";
export type SentimentLabel = "positive" | "neutral" | "negative";
export type ReviewStatus = "new" | "reviewed";

export type Review = {
  id: string;
  source: string;
  rating: number;
  language: ReviewLanguage;
  reviewerName: string;
  reviewText: string;
  reviewCreatedAt: string;
  status: ReviewStatus;
  sentiment: {
    label: SentimentLabel;
    confidence: number;
    summaryTags: string[];
  };
};
