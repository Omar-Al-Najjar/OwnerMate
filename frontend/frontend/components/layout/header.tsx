import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
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

function NavSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
    />
  );
}

export function Header({
  common,
  currentSection,
  locale,
  navigation,
  sections,
  shell: _shell,
  signOutLabel,
  signOutPendingLabel,
}: HeaderProps) {
  const isRtl = locale === "ar";
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<Route | null>(null);
  const dashboardHref = `/${locale}/dashboard` as Route;

  useEffect(() => {
    setPendingHref(null);
    setIsMobileNavOpen(false);
  }, [currentSection, locale, pathname]);

  const handleNavigation = (href: Route, isActive: boolean) => {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (isActive) {
        event.preventDefault();
        return;
      }

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    };
  };

  const renderSectionLink = (
    section: HeaderProps["sections"][number],
    mobile = false
  ) => {
    const isActive = currentSection === section.key;
    const isPending = pendingHref === section.href;

    return (
      <Link
        aria-busy={isPending ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative inline-flex items-center gap-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
          mobile
            ? "min-h-10 rounded-md px-3 py-2 focus-visible:ring-offset-card"
            : "h-12 px-3 focus-visible:ring-offset-card",
          isActive
            ? "text-foreground"
            : mobile
              ? "text-muted hover:bg-surface-low hover:text-foreground"
              : "text-muted hover:text-foreground",
          isPending &&
            "text-primary",
          mobile && (isRtl ? "text-right" : "text-left")
        )}
        href={section.href}
        key={section.href}
        onFocus={() => router.prefetch(section.href)}
        onMouseEnter={() => router.prefetch(section.href)}
        onClick={handleNavigation(section.href, isActive)}
      >
        <span className="inline-flex items-center gap-2" dir={isRtl ? "rtl" : "ltr"}>
          <span>{section.label}</span>
          {isPending ? <NavSpinner /> : null}
        </span>
        {isActive && !mobile ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-foreground"
          />
        ) : null}
        {isPending ? (
          <span className="sr-only">
            {section.label} {common.loading}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-panel backdrop-blur-xl"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex w-full max-w-[96rem] flex-col px-4 md:px-6">
        <div className="flex min-h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
            <button
              aria-expanded={isMobileNavOpen}
              aria-label={common.openNavigation}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-surface-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
              onClick={() => setIsMobileNavOpen((value) => !value)}
              type="button"
            >
              <MenuIcon />
            </button>

            <Link
              className="flex h-14 min-w-0 items-center gap-3 border-border pe-4 transition hover:opacity-90 md:border-e"
              href={dashboardHref}
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-[11px] font-bold text-primary shadow-panel"
                dir="ltr"
              >
                OM
              </span>
              <span className={cn("min-w-0", isRtl && "text-right")}>
                <span
                  className="block truncate text-sm font-bold text-foreground"
                  dir="ltr"
                >
                  {navigation.appName}
                </span>
              </span>
            </Link>

            <nav className="hidden h-14 items-center gap-0.5 md:flex">
              {sections.map((section) => renderSectionLink(section))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <UserMenu
              common={common}
              isRtl={isRtl}
              locale={locale}
              pendingLabel={signOutPendingLabel}
              settingsLabel={navigation.settings}
              signOutLabel={signOutLabel}
            />
          </div>
        </div>

        {isMobileNavOpen ? (
          <div className="pb-4 md:hidden">
            <div className="rounded-xl border border-border bg-card p-3 shadow-panel">
              <nav className="grid gap-2">
                {sections.map((section) => renderSectionLink(section, true))}
              </nav>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
