import type { Route } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import type {
  AuthDictionary,
  CommonDictionary,
  LandingDictionary,
} from "@/types/i18n";

type LinkHref = React.ComponentProps<typeof Link>["href"];

type LandingPageProps = {
  auth: AuthDictionary;
  common: CommonDictionary;
  dictionary: LandingDictionary;
  locale: Locale;
};

type FeatureCard = {
  title: string;
  description: string;
  eyebrow: string;
};

type StepCard = {
  title: string;
  description: string;
};

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m12 2.75 8 4.62v9.26l-8 4.62-8-4.62V7.37l8-4.62Z"
        fill="hsl(var(--primary) / 0.08)"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" fill="currentColor" r="2.9" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-3.5 w-3.5", className)}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M3.25 8h9.5m-3.5-3.5L12.75 8l-3.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("premium-eyebrow", className)}>
      {children}
    </span>
  );
}

function LandingButton({
  children,
  href,
  variant = "secondary",
  className,
}: {
  children: React.ReactNode;
  href: LinkHref;
  variant?: "ink" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold shadow-panel transition duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        variant === "ink" &&
          "border border-ink bg-ink text-background hover:-translate-y-0.5 hover:bg-ink/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90",
        variant === "secondary" &&
          "border border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-border/80 hover:bg-surface-low",
        variant === "ghost" &&
          "border border-transparent bg-transparent text-muted shadow-none hover:text-foreground",
        className
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function SectionHeading({
  align = "start",
  eyebrow,
  title,
  description,
}: {
  align?: "start" | "center";
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div
      className={cn(
        "landing-reveal max-w-2xl",
        align === "center" && "mx-auto text-center"
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-serif text-[2.5rem] font-normal leading-[1.02] tracking-[-0.045em] text-foreground sm:text-[3.25rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-[15px] leading-8 text-muted sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ProductBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "negative" | "brand";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold leading-none",
        tone === "neutral" && "bg-surface-high text-muted",
        tone === "positive" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/12 text-warning",
        tone === "negative" && "bg-error/12 text-error",
        tone === "brand" && "bg-primary/10 text-primary"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function ProductFrame({ dictionary, locale }: { dictionary: LandingDictionary; locale: Locale }) {
  const isRtl = locale === "ar";
  const sentiment = [
    {
      label: dictionary.previewPositiveLabel,
      value: "68%",
      width: "68%",
      className: "bg-success",
    },
    {
      label: dictionary.previewNeutralLabel,
      value: "21%",
      width: "21%",
      className: "bg-chart-neutral",
    },
    {
      label: dictionary.previewNegativeLabel,
      value: "11%",
      width: "11%",
      className: "bg-error",
    },
  ];
  const bars = ["42%", "67%", "54%", "78%", "63%", "88%", "74%"];

  return (
    <div className="landing-reveal relative mx-auto max-w-[1180px]">
      <div className="overflow-hidden rounded-xl border border-border bg-board shadow-frame">
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border bg-card px-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 items-center gap-2 border-e border-border pe-4">
              <LogoMark className="text-primary" />
              <span className="text-[12px] font-bold text-foreground" dir="ltr">
                OwnerMate
              </span>
            </div>
            <nav className="hidden items-center gap-1 md:flex">
              {[
                dictionary.navInsights,
                dictionary.previewSalesSectionTitle,
                dictionary.previewReviewsSectionTitle,
              ].map((item, index) => (
                <span
                  className={cn(
                    "relative flex h-12 items-center px-2.5 text-[12px] font-semibold",
                    index === 0 ? "text-foreground" : "text-muted"
                  )}
                  key={item}
                >
                  {item}
                  {index === 0 ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground" />
                  ) : null}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {dictionary.previewChartRange}
            </span>
            <span className="rounded border border-border bg-surface-low px-2 py-1">
              {dictionary.navInsights}
            </span>
          </div>
        </div>

        <div className="border-b border-border bg-card px-5 py-4">
          <p className="text-[11px] text-muted">{dictionary.previewEyebrow}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-[25px] font-normal leading-none text-foreground">
              {dictionary.previewTitle}
            </h3>
            <ProductBadge tone="warning">{dictionary.previewChartRange}</ProductBadge>
          </div>
        </div>

        <div className="grid gap-3 bg-board p-3 lg:grid-cols-12">
          <div className="rounded-xl border border-border bg-card p-4 shadow-panel lg:col-span-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Eyebrow>{dictionary.previewPanelTitle}</Eyebrow>
                <p className="mt-2 font-serif text-[28px] leading-none text-foreground">
                  142
                  <span className="ms-1 font-sans text-[12px] text-muted">
                    {dictionary.previewReviewsLabel}
                  </span>
                </p>
              </div>
              <ProductBadge tone="brand">{dictionary.featureTwoTitle}</ProductBadge>
            </div>
            <div className="mt-5 space-y-3">
              {sentiment.map((item) => (
                <div
                  className="rounded-lg border border-border bg-surface-low p-3"
                  key={item.label}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="font-serif text-[20px] leading-none text-foreground">
                      {item.value}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-high">
                    <div
                      className={cn("h-full rounded-full", item.className)}
                      style={{ width: item.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-panel lg:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Eyebrow>{dictionary.previewChartTitle}</Eyebrow>
                <p className="mt-2 text-[12px] text-muted">
                  {dictionary.previewSalesInsightsTitle}
                </p>
              </div>
              <ProductBadge tone="positive">{dictionary.previewChartRange}</ProductBadge>
            </div>
            <div className="mt-5 flex h-44 items-end gap-2">
              {bars.map((height, index) => (
                <div className="flex h-full flex-1 flex-col items-center gap-2" key={height}>
                  <div className="flex h-full w-full items-end rounded-full bg-surface-low px-1.5 pb-1.5">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-primary to-success"
                      style={{ height }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">
                    {dictionary.previewDays[index]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-panel lg:col-span-3">
            <div className="border-b border-border px-4 py-3">
              <Eyebrow>{dictionary.previewLatestInsightsTitle}</Eyebrow>
            </div>
            <div className="divide-y divide-border/70">
              {dictionary.previewInsightItems.map((item, index) => (
                <div
                  className="flex gap-3 px-4 py-3 transition hover:bg-surface-low"
                  key={item}
                >
                  <span className="mt-0.5 font-serif text-[18px] leading-none text-primary">
                    {isRtl ? index + 1 : `0${index + 1}`}
                  </span>
                  <p className="text-[12px] leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-panel lg:col-span-12">
            <div className="flex flex-wrap items-center gap-4">
              <Eyebrow>{dictionary.solutionEyebrow}</Eyebrow>
              <span className="font-serif text-[24px] leading-none text-foreground">
                {dictionary.featureFiveTitle}
              </span>
              <div className="h-px min-w-16 flex-1 bg-gradient-to-r from-primary to-transparent rtl:bg-gradient-to-l" />
              <span className="text-[12px] text-muted">{dictionary.solutionPointFour}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustStrip({ dictionary }: { dictionary: LandingDictionary }) {
  const items = [
    dictionary.featureOneTitle,
    dictionary.featureTwoTitle,
    dictionary.featureThreeTitle,
    dictionary.featureFourTitle,
    dictionary.featureFiveTitle,
  ];

  return (
    <section className="border-y border-border bg-paper py-10">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <div className="landing-reveal text-center">
          <Eyebrow>{dictionary.featuresEyebrow}</Eyebrow>
        </div>
        <div className="landing-reveal mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((item, index) => (
            <span
              className={cn(
                "text-sm font-semibold text-muted transition hover:text-foreground",
                index % 2 === 0 && "font-serif text-xl font-normal italic"
              )}
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryPillars({ dictionary }: { dictionary: LandingDictionary }) {
  const pillars: FeatureCard[] = [
    {
      eyebrow: dictionary.featureOneTitle,
      title: dictionary.problemCardOneTitle,
      description: dictionary.problemCardOneDescription,
    },
    {
      eyebrow: dictionary.featureTwoTitle,
      title: dictionary.problemCardThreeTitle,
      description: dictionary.problemCardThreeDescription,
    },
    {
      eyebrow: dictionary.featureThreeTitle,
      title: dictionary.problemCardTwoTitle,
      description: dictionary.problemCardTwoDescription,
    },
  ];

  return (
    <section className="bg-paper py-24 sm:py-28" id="solution">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <SectionHeading
          description={dictionary.solutionDescription}
          eyebrow={dictionary.solutionEyebrow}
          title={dictionary.solutionTitle}
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <article
              className="landing-reveal flex h-full flex-col rounded-xl border border-border bg-card p-7 shadow-panel"
              key={pillar.title}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/15 bg-primary/8 text-primary">
                  <LogoMark className="h-4 w-4" />
                </span>
                <Eyebrow>{pillar.eyebrow}</Eyebrow>
              </div>
              <h3 className="font-serif text-[24px] font-normal leading-tight tracking-[-0.025em] text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-4 flex-1 text-[13px] leading-7 text-muted">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductShowcase({
  dictionary,
  locale,
}: {
  dictionary: LandingDictionary;
  locale: Locale;
}) {
  return (
    <section className="border-y border-border bg-board py-24 sm:py-28" id="insights">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <div className="grid items-end gap-8 md:grid-cols-[1.05fr_0.95fr]">
          <SectionHeading
            description={dictionary.previewDescription}
            eyebrow={dictionary.previewEyebrow}
            title={dictionary.previewTitle}
          />
          <div className="landing-reveal grid grid-cols-2 gap-5">
            {[
              {
                label: dictionary.previewReviewsSectionTitle,
                value: "142",
                helper: dictionary.previewReviewsLabel,
              },
              {
                label: dictionary.featureTwoTitle,
                value: "68%",
                helper: dictionary.previewPositiveLabel,
              },
              {
                label: dictionary.previewSalesSectionTitle,
                value: "7",
                helper: dictionary.previewChartRange,
              },
              {
                label: dictionary.featureFiveTitle,
                value: "3",
                helper: dictionary.previewLatestInsightsTitle,
              },
            ].map((metric) => (
              <div key={metric.label}>
                <Eyebrow>{metric.label}</Eyebrow>
                <div className="mt-2 font-serif text-[30px] leading-none text-foreground">
                  {metric.value}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted">{metric.helper}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <ProductFrame dictionary={dictionary} locale={locale} />
        </div>
      </div>
    </section>
  );
}

function Workflow({ dictionary, locale }: { dictionary: LandingDictionary; locale: Locale }) {
  const steps: StepCard[] = [
    {
      title: dictionary.stepOneTitle,
      description: dictionary.stepOneDescription,
    },
    {
      title: dictionary.stepTwoTitle,
      description: dictionary.stepTwoDescription,
    },
    {
      title: dictionary.stepThreeTitle,
      description: dictionary.stepThreeDescription,
    },
    {
      title: dictionary.stepFourTitle,
      description: dictionary.stepFourDescription,
    },
  ];

  return (
    <section className="border-y border-border bg-board py-24 sm:py-28" id="how-it-works">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <SectionHeading
          description={dictionary.howItWorksDescription}
          eyebrow={dictionary.howItWorksEyebrow}
          title={dictionary.howItWorksTitle}
        />

        <div className="relative mt-14">
          <div className="absolute left-[5%] right-[5%] top-3 hidden h-px bg-border md:block" />
          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <article
                className="landing-reveal relative"
                key={step.title}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary bg-card font-serif text-[13px] text-primary">
                    {index + 1}
                  </span>
                  <Eyebrow>
                    {locale === "ar" ? `${index + 1}` : `Step 0${index + 1}`}
                  </Eyebrow>
                </div>
                <h3 className="font-serif text-[24px] font-normal leading-tight tracking-[-0.03em] text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-[13px] leading-7 text-muted">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureGrid({ dictionary }: { dictionary: LandingDictionary }) {
  const features: FeatureCard[] = [
    {
      eyebrow: dictionary.previewReviewsSectionTitle,
      title: dictionary.featureOneTitle,
      description: dictionary.featureOneDescription,
    },
    {
      eyebrow: dictionary.previewPanelTitle,
      title: dictionary.featureTwoTitle,
      description: dictionary.featureTwoDescription,
    },
    {
      eyebrow: dictionary.previewSalesSectionTitle,
      title: dictionary.featureThreeTitle,
      description: dictionary.featureThreeDescription,
    },
    {
      eyebrow: dictionary.navInsights,
      title: dictionary.featureFourTitle,
      description: dictionary.featureFourDescription,
    },
    {
      eyebrow: dictionary.previewLatestInsightsTitle,
      title: dictionary.featureFiveTitle,
      description: dictionary.featureFiveDescription,
    },
    {
      eyebrow: dictionary.howItWorksEyebrow,
      title: dictionary.solutionTitle,
      description: dictionary.solutionPointFour,
    },
  ];

  return (
    <section className="bg-paper py-24 sm:py-28" id="features">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <SectionHeading
          description={dictionary.featuresDescription}
          eyebrow={dictionary.featuresEyebrow}
          title={dictionary.featuresTitle}
        />

        <div className="landing-reveal mt-12 grid overflow-hidden rounded-xl border border-border bg-border shadow-panel sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              className="min-h-56 bg-card p-7 transition duration-200 hover:bg-surface-low"
              key={feature.title}
            >
              <Eyebrow>{feature.eyebrow}</Eyebrow>
              <h3 className="mt-5 text-[15px] font-bold leading-6 text-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-[12.5px] leading-7 text-muted">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({
  auth,
  dictionary,
  signInHref,
  signUpHref,
}: {
  auth: AuthDictionary;
  dictionary: LandingDictionary;
  signInHref: Route;
  signUpHref: Route;
}) {
  return (
    <section className="bg-paper py-24 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
        <div className="landing-reveal relative overflow-hidden rounded-2xl border border-ink bg-ink px-6 py-16 text-center text-background shadow-frame sm:px-10">
          <div className="landing-dot-grid absolute inset-0 opacity-[0.08]" />
          <div className="relative mx-auto max-w-3xl">
            <Eyebrow className="text-background/55">{dictionary.solutionEyebrow}</Eyebrow>
            <h2 className="mt-4 font-serif text-[3rem] font-normal leading-[1.03] tracking-[-0.045em] text-background sm:text-[4rem]">
              {dictionary.finalCtaTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-8 text-background/70">
              {dictionary.finalCtaDescription}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <LandingButton
                className="border-background bg-background text-ink hover:bg-background/90"
                href={signInHref}
              >
                {auth.signIn}
                <ArrowIcon />
              </LandingButton>
              <LandingButton
                className="border-background/20 bg-background/5 text-background hover:bg-background/10"
                href={signUpHref}
                variant="secondary"
              >
                {auth.signUp}
              </LandingButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({
  dictionary,
  homeHref,
}: {
  dictionary: LandingDictionary;
  homeHref: Route;
}) {
  const links = [
    { href: "#solution", label: dictionary.navProduct },
    { href: "#features", label: dictionary.navFeatures },
    { href: "#how-it-works", label: dictionary.navHowItWorks },
    { href: "#insights", label: dictionary.navInsights },
  ];

  return (
    <footer className="border-t border-border bg-paper">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <div>
          <Link className="inline-flex items-center gap-2" href={homeHref}>
            <LogoMark className="text-primary" />
            <span className="text-sm font-bold text-foreground" dir="ltr">
              OwnerMate
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-[13px] leading-7 text-muted">
            {dictionary.footerNote}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {links.map((link) => (
            <a
              className="text-[12.5px] font-semibold text-muted transition hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-border px-5 py-5 text-center text-[11.5px] text-text-subtle">
        OwnerMate
      </div>
    </footer>
  );
}

export function LandingPage({
  auth,
  common,
  dictionary,
  locale,
}: LandingPageProps) {
  const homeHref = `/${locale}` as Route;
  const signInHref = `/${locale}/sign-in` as Route;
  const signUpHref = `/${locale}/sign-up` as Route;

  return (
    <main className="landing-page min-h-screen overflow-x-hidden bg-paper text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-paper/88 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-8">
            <Link className="flex items-center gap-2" href={homeHref}>
              <LogoMark className="text-primary" />
              <span
                className="text-[15px] font-bold tracking-[-0.02em] text-foreground"
                dir="ltr"
              >
                OwnerMate
              </span>
            </Link>
            <nav className="hidden items-center gap-7 lg:flex">
              {[
                { href: "#solution", label: dictionary.navProduct },
                { href: "#features", label: dictionary.navFeatures },
                { href: "#how-it-works", label: dictionary.navHowItWorks },
                { href: "#insights", label: dictionary.navInsights },
              ].map((item) => (
                <a
                  className="text-[13px] font-semibold text-muted transition hover:text-foreground"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher common={common} locale={locale} />
            <ThemeToggle common={common} />
            <LandingButton className="hidden sm:inline-flex" href={signInHref} variant="ghost">
              {auth.signIn}
            </LandingButton>
            <LandingButton href={signUpHref} variant="ink">
              {auth.signUp}
            </LandingButton>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pb-24 pt-20 sm:pb-28 sm:pt-24">
        <div className="landing-dot-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-[1280px] px-5 sm:px-6 lg:px-8">
          <div className="landing-reveal mx-auto mb-8 flex justify-center">
            <a
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pe-3.5 ps-1 shadow-panel transition hover:border-border/80"
              href="#insights"
            >
              <ProductBadge tone="brand">{dictionary.heroEyebrow}</ProductBadge>
              <span className="text-[12px] text-muted">{dictionary.previewTitle}</span>
              <ArrowIcon
                className={cn("text-text-subtle", locale === "ar" && "rotate-180")}
              />
            </a>
          </div>

          <h1 className="landing-reveal mx-auto max-w-5xl text-center font-serif text-[4.2rem] font-normal leading-[0.95] tracking-[-0.065em] text-foreground sm:text-[5.5rem] lg:text-[6.5rem]">
            {dictionary.heroTitle}
          </h1>
          <p className="landing-reveal mx-auto mt-7 max-w-2xl text-center text-[17px] leading-8 text-muted">
            {dictionary.heroDescription}
          </p>
          <div className="landing-reveal mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LandingButton href={signUpHref} variant="ink">
              {auth.signUp}
              <ArrowIcon className={locale === "ar" ? "rotate-180" : undefined} />
            </LandingButton>
            <LandingButton href={signInHref}>{auth.signIn}</LandingButton>
          </div>

          <div className="mt-16">
            <ProductFrame dictionary={dictionary} locale={locale} />
          </div>
        </div>
      </section>

      <TrustStrip dictionary={dictionary} />
      <StoryPillars dictionary={dictionary} />
      <ProductShowcase dictionary={dictionary} locale={locale} />
      <Workflow dictionary={dictionary} locale={locale} />
      <FeatureGrid dictionary={dictionary} />
      <FinalCta
        auth={auth}
        dictionary={dictionary}
        signInHref={signInHref}
        signUpHref={signUpHref}
      />
      <Footer dictionary={dictionary} homeHref={homeHref} />
    </main>
  );
}
