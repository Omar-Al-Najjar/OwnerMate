"use client";

import { useMemo } from "react";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PageContainer } from "@/components/layout/page-container";
import type { Locale } from "@/lib/i18n/config";
import type {
  CommonDictionary,
  NavigationDictionary,
  ShellDictionary,
} from "@/types/i18n";

type AppShellProps = {
  children: React.ReactNode;
  common: CommonDictionary;
  locale: Locale;
  navigation: NavigationDictionary;
  shell: ShellDictionary;
  signOutLabel: string;
  signOutPendingLabel: string;
};

type SectionKey =
  | "dashboard"
  | "reviews"
  | "dataset-analysis"
  | "settings";

const sectionOrder: SectionKey[] = [
  "dashboard",
  "reviews",
  "dataset-analysis",
  "settings",
];

export function AppShell({
  children,
  common,
  locale,
  navigation,
  shell,
  signOutLabel,
  signOutPendingLabel,
}: AppShellProps) {
  const pathname = usePathname();
  const skipLinkLabel = locale === "ar" ? "تجاوز إلى المحتوى" : "Skip to content";

  const navItems = useMemo(
    () => [
      {
        key: "dashboard" as const,
        href: `/${locale}/dashboard` as Route,
        label: navigation.dashboard,
      },
      {
        key: "reviews" as const,
        href: `/${locale}/reviews` as Route,
        label: navigation.reviews,
      },
      {
        key: "dataset-analysis" as const,
        href: `/${locale}/dataset-analysis` as Route,
        label: navigation.datasetAnalysis,
      },
    ],
    [
      locale,
      navigation.dashboard,
      navigation.datasetAnalysis,
      navigation.reviews,
    ]
  );

  const currentSection = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const section = segments[1] as SectionKey | undefined;
    return sectionOrder.includes(section ?? "dashboard")
      ? (section ?? "dashboard")
      : "dashboard";
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        {skipLinkLabel}
      </a>

      <Header
        common={common}
        currentSection={currentSection}
        locale={locale}
        navigation={navigation}
        sections={navItems}
        shell={shell}
        signOutLabel={signOutLabel}
        signOutPendingLabel={signOutPendingLabel}
      />
      <div className="relative min-h-screen">
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
