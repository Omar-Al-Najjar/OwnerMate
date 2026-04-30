"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Header } from "@/components/layout/header";
import { PageContainer } from "@/components/layout/page-container";
import { Sidebar } from "@/components/layout/sidebar";
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isRtl = locale === "ar";

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

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
      {
        key: "settings" as const,
        href: `/${locale}/settings` as Route,
        label: navigation.settings,
      },
    ],
    [
      locale,
      navigation.dashboard,
      navigation.datasetAnalysis,
      navigation.reviews,
      navigation.settings,
    ]
  );

  const currentSection = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const section = segments[1] as SectionKey | undefined;
    return sectionOrder.includes(section ?? "dashboard")
      ? (section ?? "dashboard")
      : "dashboard";
  }, [pathname]);

  const pageContext = {
    title:
      currentSection === "dashboard"
        ? navigation.dashboard
        : currentSection === "reviews"
          ? navigation.reviews
          : currentSection === "dataset-analysis"
              ? navigation.datasetAnalysis
              : navigation.settings,
    description:
      currentSection === "dashboard"
        ? shell.dashboardDescription
        : currentSection === "reviews"
          ? shell.reviewsDescription
          : currentSection === "dataset-analysis"
              ? shell.datasetAnalysisDescription
              : shell.settingsDescription,
  };

  const sidebarPlacement = isRtl ? "md:right-0" : "md:left-0";
  const contentOffset = isRtl ? "md:pr-72" : "md:pl-72";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,rgba(0,83,219,0.12),transparent_52%)]" />
        <div className="absolute -right-24 top-48 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,23,75,0.12),transparent_68%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(106,152,255,0.16),transparent_68%)]" />
      </div>

      <Sidebar
        common={common}
        isMobileOpen={isMobileNavOpen}
        isRtl={isRtl}
        locale={locale}
        navigation={navigation}
        onClose={() => setIsMobileNavOpen(false)}
        pathname={pathname}
        placementClass={sidebarPlacement}
        sections={navItems}
      />

      <div className={`${contentOffset} relative min-h-screen`}>
        <Header
          common={common}
          isMobileNavOpen={isMobileNavOpen}
          isRtl={isRtl}
          locale={locale}
          onOpenNavigation={() => setIsMobileNavOpen((value) => !value)}
          pageContext={pageContext}
          signOutAction={
            <SignOutButton
              label={signOutLabel}
              locale={locale}
              pendingLabel={signOutPendingLabel}
            />
          }
        />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
