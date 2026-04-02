"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { usePathname } from "next/navigation";
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
};

type SectionKey = "dashboard" | "reviews" | "ai-content" | "settings";

const sectionOrder: SectionKey[] = [
  "dashboard",
  "reviews",
  "ai-content",
  "settings",
];

export function AppShell({
  children,
  common,
  locale,
  navigation,
  shell,
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
        key: "ai-content" as const,
        href: `/${locale}/ai-content` as Route,
        label: navigation.aiContent,
      },
      {
        key: "settings" as const,
        href: `/${locale}/settings` as Route,
        label: navigation.settings,
      },
    ],
    [
      locale,
      navigation.aiContent,
      navigation.dashboard,
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
          : currentSection === "ai-content"
            ? navigation.aiContent
            : navigation.settings,
    description:
      currentSection === "dashboard"
        ? shell.dashboardDescription
        : currentSection === "reviews"
          ? shell.reviewsDescription
          : currentSection === "ai-content"
            ? shell.aiContentDescription
            : shell.settingsDescription,
  };

  const sidebarPlacement = isRtl
    ? "md:right-0 md:border-l"
    : "md:left-0 md:border-r";
  const contentOffset = isRtl ? "md:pr-72" : "md:pl-72";

  return (
    <div className="min-h-screen bg-background text-foreground">
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
      <div className={contentOffset}>
        <Header
          common={common}
          isMobileNavOpen={isMobileNavOpen}
          isRtl={isRtl}
          locale={locale}
          onOpenNavigation={() => setIsMobileNavOpen((value) => !value)}
          pageContext={pageContext}
        />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
