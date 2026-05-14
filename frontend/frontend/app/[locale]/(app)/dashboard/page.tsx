import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { apiClient } from "@/lib/api/client";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

type DashboardPageProps = LocaleParams & {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);
  const dashboardResponse = await apiClient.getDashboard(resolvedSearchParams);
  const dashboardData =
    dashboardResponse.status === "success"
      ? dashboardResponse.data ?? null
      : null;

  return (
    <DashboardWorkspace
      data={dashboardData}
      dictionary={dictionary}
      locale={safeLocale}
    />
  );
}
