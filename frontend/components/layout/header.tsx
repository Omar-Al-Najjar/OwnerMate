import { CurrentDateTime } from "@/components/navigation/current-datetime";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ProfileChip } from "@/components/navigation/profile-chip";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import type { Locale } from "@/lib/i18n/config";
import type { CommonDictionary } from "@/types/i18n";

type HeaderProps = {
  common: CommonDictionary;
  isMobileNavOpen: boolean;
  isRtl: boolean;
  locale: Locale;
  onOpenNavigation: () => void;
  pageContext: {
    title: string;
    description: string;
  };
  signOutAction: React.ReactNode;
};

export function Header({
  common,
  isMobileNavOpen,
  isRtl,
  locale,
  onOpenNavigation,
  pageContext,
  signOutAction,
}: HeaderProps) {
  const alignClass = isRtl ? "text-right" : "text-left";

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 md:px-8 md:pt-6">
      <div className="mx-auto max-w-[90rem]">
        <div className="flex flex-col gap-4 rounded-2xl bg-card/88 px-4 py-4 shadow-panel ring-1 ring-inset ring-border/70 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-5">
          <div
            className={`flex min-w-0 items-start gap-3 ${isRtl ? "flex-row-reverse" : "flex-row"}`}
          >
            <button
              aria-expanded={isMobileNavOpen}
              aria-label={common.openNavigation}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-surface-low text-foreground transition hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card md:hidden"
              onClick={onOpenNavigation}
              type="button"
            >
              <span aria-hidden="true" className="space-y-1.5">
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
              </span>
            </button>

            <div className={`min-w-0 space-y-1 ${alignClass}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                {pageContext.title}
              </p>
              <p className="max-w-2xl text-sm leading-6 text-muted md:text-[0.95rem]">
                {pageContext.description}
              </p>
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center gap-2.5 ${isRtl ? "flex-row-reverse" : "flex-row"}`}
          >
            <CurrentDateTime locale={locale} />

            <div className="flex items-center gap-1 rounded-2xl bg-surface-low px-1.5 py-1 ring-1 ring-inset ring-border/70">
              <LanguageSwitcher common={common} locale={locale} />
              <ThemeToggle common={common} />
            </div>

            <div className="hidden lg:block">
              <ProfileChip isRtl={isRtl} />
            </div>

            {signOutAction}
          </div>
        </div>
      </div>
    </header>
  );
}
