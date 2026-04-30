import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { UserMenu } from "@/components/navigation/user-menu";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import type {
  CommonDictionary,
  NavigationDictionary,
  ShellDictionary,
} from "@/types/i18n";

type SectionKey =
  | "dashboard"
  | "reviews"
  | "dataset-analysis"
  | "settings";

type HeaderProps = {
  common: CommonDictionary;
  currentSection: SectionKey;
  locale: Locale;
  navigation: NavigationDictionary;
  sections: Array<{
    key: "dashboard" | "reviews" | "dataset-analysis";
    href: Route;
    label: string;
  }>;
  shell: ShellDictionary;
  signOutLabel: string;
  signOutPendingLabel: string;
};

function MenuIcon() {
  return (
    <span aria-hidden="true" className="space-y-1.5">
      <span className="block h-0.5 w-4 bg-current" />
      <span className="block h-0.5 w-4 bg-current" />
      <span className="block h-0.5 w-4 bg-current" />
    </span>
  );
}

export function Header({
  common,
  currentSection,
  locale,
  navigation,
  sections,
  shell,
  signOutLabel,
  signOutPendingLabel,
}: HeaderProps) {
  const isRtl = locale === "ar";
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const dashboardHref = `/${locale}/dashboard` as Route;

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [currentSection, locale]);

  const currentDescription =
    currentSection === "dashboard"
      ? shell.dashboardDescription
      : currentSection === "reviews"
        ? shell.reviewsDescription
        : currentSection === "dataset-analysis"
          ? shell.datasetAnalysisDescription
          : shell.settingsDescription;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/84 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col px-4 py-4 md:px-8">
        <div
          className={cn(
            "flex items-center justify-between gap-4",
            isRtl && "flex-row-reverse"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-3 lg:gap-5",
              isRtl && "flex-row-reverse"
            )}
          >
            <button
              aria-expanded={isMobileNavOpen}
              aria-label={common.openNavigation}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card/90 text-foreground transition hover:bg-surface-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
              onClick={() => setIsMobileNavOpen((value) => !value)}
              type="button"
            >
              <MenuIcon />
            </button>

            <Link
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-full px-1 py-1 transition hover:opacity-90",
                isRtl && "flex-row-reverse"
              )}
              href={dashboardHref}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-container text-sm font-bold tracking-[0.18em] text-white shadow-float">
                OM
              </span>
              <span className={cn("min-w-0", isRtl && "text-right")}>
                <span className="block truncate text-base font-bold tracking-[-0.04em] text-foreground">
                  {navigation.appName}
                </span>
                <span className="hidden truncate text-xs text-muted lg:block">
                  {navigation.frontendOnly}
                </span>
              </span>
            </Link>

            <nav
              className={cn(
                "hidden items-center gap-1 rounded-full border border-border/70 bg-card/92 p-1 shadow-panel md:flex",
                isRtl && "flex-row-reverse"
              )}
            >
              {sections.map((section) => {
                const isActive = currentSection === section.key;
                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-primary/20"
                        : "text-muted hover:bg-surface-low hover:text-foreground"
                    )}
                    href={section.href}
                    key={section.href}
                  >
                    {section.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div
            className={cn(
              "flex shrink-0 items-center gap-2",
              isRtl && "flex-row-reverse"
            )}
          >
            <div
              className="hidden items-center gap-1 rounded-full border border-border/70 bg-card/92 p-1 shadow-panel sm:flex"
              dir="ltr"
            >
              <LanguageSwitcher common={common} locale={locale} />
              <ThemeToggle common={common} />
            </div>

            <UserMenu
              isRtl={isRtl}
              locale={locale}
              pendingLabel={signOutPendingLabel}
              settingsLabel={navigation.settings}
              signOutLabel={signOutLabel}
            />
          </div>
        </div>

        {isMobileNavOpen ? (
          <div className="mt-4 md:hidden">
            <div className="rounded-3xl border border-border/70 bg-card/94 p-3 shadow-panel backdrop-blur-xl">
              <nav className="grid gap-2">
                {sections.map((section) => {
                  const isActive = currentSection === section.key;
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        isRtl ? "text-right" : "text-left",
                        isActive
                          ? "bg-primary/12 text-primary ring-1 ring-inset ring-primary/20"
                          : "text-foreground hover:bg-surface-low"
                      )}
                      href={section.href}
                      key={section.href}
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      {section.label}
                    </Link>
                  );
                })}
              </nav>

              <div
                className={cn(
                  "mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-low/70 px-4 py-3",
                  isRtl && "flex-row-reverse"
                )}
              >
                <div className={cn("min-w-0", isRtl && "text-right")}>
                  <p className="text-sm font-semibold text-foreground">
                    {navigation.appName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {currentDescription}
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 rounded-full border border-border/70 bg-card/92 p-1 shadow-panel"
                  dir="ltr"
                >
                  <LanguageSwitcher common={common} locale={locale} />
                  <ThemeToggle common={common} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
