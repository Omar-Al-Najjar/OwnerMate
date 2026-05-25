import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

function firstSearchValue(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  return value && value !== "all" ? value : undefined;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const dashboardResponse = await apiClient.getDashboard({
    range: requestUrl.searchParams.get("range") ?? undefined,
    source: firstSearchValue(requestUrl.searchParams, "source"),
    language: firstSearchValue(requestUrl.searchParams, "language"),
    sentiment: firstSearchValue(requestUrl.searchParams, "sentiment"),
  });

  if (dashboardResponse.status === "error") {
    return NextResponse.json(
      {
        success: false,
        error: dashboardResponse.error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: dashboardResponse.data ?? null,
  });
}
