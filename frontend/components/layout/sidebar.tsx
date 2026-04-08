import type { Route } from "next";
import Link from "next/link";
import { ProfileChip } from "@/components/navigation/profile-chip";
import { NavItem } from "@/components/navigation/nav-item";
import type { Locale } from "@/lib/i18n/config";
import type { CommonDictionary, NavigationDictionary } from "@/types/i18n";

type SidebarProps = {
  common: CommonDictionary;
  isMobileOpen: boolean;
  isRtl: boolean;
  locale: Locale;
  navigation: NavigationDictionary;
  onClose: () => void;
  pathname: string;
  placementClass: string;
  sections: Array<{
    key:
      | "dashboard"
      | "reviews"
      | "ai-content"
      | "dataset-analysis"
      | "settings";
    href: Route;
    label: string;
  }>;
};

export function Sidebar({
  common,
  isMobileOpen,
  isRtl,
  locale,
  navigation,
  onClose,
  pathname,
  placementClass,
  sections,
}: SidebarProps) {
  const mobileAnchor = isRtl ? "right-0" : "left-0";
  const mobileTransform = isMobileOpen
    ? "translate-x-0"
    : isRtl
      ? "translate-x-full"
      : "-translate-x-full";
  const desktopSideBorder = isRtl ? "md:border-l" : "md:border-r";
  const panelTextAlign = isRtl ? "text-right" : "text-left";
  const dashboardHref = `/${locale}/dashboard` as Route;

  return (
    <>
      <div
        aria-hidden={!isMobileOpen}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity md:hidden ${isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        aria-label={navigation.appName}
        className={`fixed inset-y-0 z-50 flex w-[17.5rem] flex-col border-border bg-card/95 transition-transform duration-200 md:z-30 md:w-72 md:translate-x-0 ${mobileAnchor} ${mobileTransform} ${desktopSideBorder} ${placementClass}`}
      >
        <div className={`border-b border-border px-5 py-6 ${panelTextAlign}`}>
          <div className="flex items-center justify-between gap-3 md:block">
            <div>
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-semibold tracking-[0.18em] text-primary shadow-sm dark:bg-indigo-950/40 dark:text-indigo-100">
                OM
              </div>
              <Link
                className="block text-xl font-semibold tracking-tight text-foreground"
                href={dashboardHref}
              >
                {navigation.appName}
              </Link>
              <p className="mt-1 max-w-56 text-sm leading-6 text-muted">
                {navigation.frontendOnly}
              </p>
            </div>
            <button
              aria-label={common.closeNavigation}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition hover:bg-surface hover:text-foreground md:hidden"
              onClick={onClose}
              type="button"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
        </div>
        <div className="px-4 pt-5">
          <ProfileChip isRtl={isRtl} variant="sidebar" />
        </div>
        <nav className="flex flex-1 flex-col gap-2 px-4 py-5">
          {sections.map((item) => (
            <NavItem
              key={item.href}
              active={
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              }
              href={item.href}
              icon={item.key}
              isRtl={isRtl}
              label={item.label}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
