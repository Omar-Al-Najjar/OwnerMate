import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { apiClient } from "@/lib/api/client";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function DashboardSalesPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);
  const dashboardResponse = await apiClient.getDashboard();
  const dashboardData =
    dashboardResponse.status === "success"
      ? dashboardResponse.data ?? null
      : null;

  return (
    <DashboardWorkspace
      data={dashboardData}
      dictionary={dictionary}
      locale={safeLocale}
      mode="sales-detail"
    />
  );
}
