import type { Route } from "next";
import Link from "next/link";
import { NavItem } from "@/components/navigation/nav-item";
import { ProfileChip } from "@/components/navigation/profile-chip";
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
  const mobileVisibility = isMobileOpen ? "visible" : "invisible md:visible";
  const dashboardHref = `/${locale}/dashboard` as Route;

  return (
    <>
      <div
        aria-hidden={!isMobileOpen}
        className={`fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm transition-opacity md:hidden ${isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      <aside
        aria-label={navigation.appName}
        className={`fixed inset-y-0 z-50 flex w-[18rem] flex-col bg-sidebar/94 text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04),24px_0_64px_-44px_rgba(2,6,23,0.28)] ring-1 ring-inset ring-sidebar-border/80 backdrop-blur-2xl transition-transform duration-200 md:z-30 md:translate-x-0 ${mobileAnchor} ${mobileTransform} ${mobileVisibility} ${placementClass}`}
      >
        <div className="px-5 pb-5 pt-6">
          <div
            className={`flex items-start justify-between gap-3 ${isRtl ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`min-w-0 space-y-3 ${isRtl ? "text-right" : "text-left"}`}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-container text-sm font-semibold tracking-[0.2em] text-white ring-1 ring-inset ring-white/10 shadow-float">
                OM
              </div>
              <div className="space-y-1">
                <Link
                  className="block font-display text-[1.35rem] font-bold tracking-[-0.05em] text-sidebar-foreground"
                  href={dashboardHref}
                >
                  {navigation.appName}
                </Link>
                <p className="max-w-56 text-sm leading-6 text-sidebar-muted">
                  {navigation.frontendOnly}
                </p>
              </div>
            </div>

            <button
              aria-label={common.closeNavigation}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-surface text-sidebar-muted transition hover:bg-sidebar-surface-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar md:hidden"
              onClick={onClose}
              type="button"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                x
              </span>
            </button>
          </div>
        </div>

        <div className="px-4">
          <ProfileChip isRtl={isRtl} variant="sidebar" />
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-6">
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
