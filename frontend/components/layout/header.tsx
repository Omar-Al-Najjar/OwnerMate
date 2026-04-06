import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { CurrentDateTime } from "@/components/navigation/current-datetime";
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
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl">
      <div className="mx-auto flex h-auto max-w-7xl flex-col gap-4 px-4 py-4 md:h-20 md:flex-row md:items-center md:justify-between md:px-8 md:py-0">
        <div
          className={`flex min-w-0 items-center gap-3 ${isRtl ? "flex-row-reverse" : "flex-row"}`}
        >
          <button
            aria-expanded={isMobileNavOpen}
            aria-label={common.openNavigation}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-surface md:hidden"
            onClick={onOpenNavigation}
            type="button"
          >
            <span aria-hidden="true" className="space-y-1.5">
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </span>
          </button>
          <div className={`min-w-0 ${alignClass}`}>
            <p className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {pageContext.title}
            </p>
            <p className="hidden truncate text-sm text-muted md:block">
              {pageContext.description}
            </p>
          </div>
        </div>
        <div
          className={`flex flex-wrap items-center gap-2 md:gap-3 ${isRtl ? "flex-row-reverse" : "flex-row"}`}
        >
          <CurrentDateTime locale={locale} />
          <div className="rounded-2xl border border-border bg-card p-1 shadow-sm">
            <LanguageSwitcher common={common} locale={locale} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-1 shadow-sm">
            <ThemeToggle common={common} />
          </div>
          {signOutAction}
        </div>
      </div>
    </header>
  );
}
