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
  icon: React.ReactNode;
};

type ProblemCard = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

type StepCard = {
  title: string;
  description: string;
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="max-w-2xl text-balance text-3xl font-semibold text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-base text-muted sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function CircleIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
      {children}
    </div>
  );
}

function ReviewsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 8.75h10M7 12h6m6 4.5-3.48-1.99a2 2 0 0 0-.99-.26H7a3 3 0 0 1-3-3v-5.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SentimentIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8.5 14.5c.9.92 2.12 1.5 3.5 1.5s2.6-.58 3.5-1.5M9 10h.01M15 10h.01M21 12c0 4.97-4.03 9-9 9a8.96 8.96 0 0 1-4.57-1.25L3 21l1.25-4.43A8.96 8.96 0 0 1 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V6.75Zm4 7.75v2M12 10.5v6M16 8v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 15.5V5.75m0 0 3.25 3.25M12 5.75 8.75 9M5.75 14.75v2.5A1.75 1.75 0 0 0 7.5 19h9a1.75 1.75 0 0 0 1.75-1.75v-2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 7.75h8M8 11.5h8M8 15.25h5M7 3.75h7.94c.46 0 .9.18 1.23.51l2.57 2.57c.33.33.51.77.51 1.23v10.19A1.75 1.75 0 0 1 17.5 20h-10A1.75 1.75 0 0 1 5.75 18.25v-12.75A1.75 1.75 0 0 1 7.5 3.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FlowArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CtaLink({
  children,
  href,
  secondary = false,
  className,
}: {
  children: React.ReactNode;
  href: LinkHref;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-[2.9rem] items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        secondary
          ? "border border-border/75 bg-card/50 text-foreground hover:bg-surface-low"
          : "bg-primary-container text-white shadow-float hover:-translate-y-px hover:brightness-110",
        className
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function DashboardPreview({
  dictionary,
}: {
  dictionary: LandingDictionary;
}) {
  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 sm:px-6 lg:px-8"
      id="insights"
    >
      <SectionHeading
        eyebrow={dictionary.previewEyebrow}
        title={dictionary.previewTitle}
        description={dictionary.previewDescription}
      />

      <div className="panel mx-auto w-full overflow-hidden rounded-[28px] border border-border/80 bg-card p-4 shadow-float sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="soft-panel rounded-[24px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {dictionary.previewReviewsSectionTitle}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {dictionary.previewPanelTitle}
                </h3>
              </div>
              <div className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-muted">
                142 {dictionary.previewReviewsLabel}
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {[
                {
                  label: dictionary.previewPositiveLabel,
                  value: "68%",
                  tone: "bg-success/12 text-success",
                  fill: "w-[68%] bg-success",
                },
                {
                  label: dictionary.previewNeutralLabel,
                  value: "21%",
                  tone: "bg-surface-high text-foreground",
                  fill: "w-[21%] bg-muted",
                },
                {
                  label: dictionary.previewNegativeLabel,
                  value: "11%",
                  tone: "bg-error/12 text-error",
                  fill: "w-[11%] bg-error",
                },
              ].map((item) => (
                <div
                  className="rounded-2xl border border-border/75 bg-card/85 p-4"
                  key={item.label}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted">{item.label}</p>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        item.tone
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-highest">
                    <div className={cn("h-full rounded-full", item.fill)} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-border/75 bg-card/90 p-4">
              <p className="text-sm font-semibold text-foreground">
                {dictionary.previewLatestInsightsTitle}
              </p>
              <ul className="mt-4 space-y-3">
                {dictionary.previewInsightItems.map((item, index) => (
                  <li
                    className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/85 p-3"
                    key={item}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-sm text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="soft-panel rounded-[24px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {dictionary.previewSalesSectionTitle}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {dictionary.previewChartTitle}
                </h3>
              </div>
              <div className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-muted">
                {dictionary.previewChartRange}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/75 bg-card/90 p-4">
              <div className="mt-1 flex h-40 items-end gap-3">
                {["44%", "72%", "58%", "84%", "66%", "92%", "77%"].map((height, index) => (
                  <div className="flex flex-1 flex-col items-center gap-3" key={height}>
                    <div className="flex h-full w-full items-end rounded-full bg-surface-low px-1.5 pb-1.5">
                      <div
                        className={cn(
                          "w-full rounded-full bg-gradient-to-t from-primary to-primary-container",
                          index % 2 === 0 ? "opacity-90" : "opacity-75"
                        )}
                        style={{ height }}
                      />
                    </div>
                    <span className="text-xs text-muted">
                      {dictionary.previewDays[index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/75 bg-card/90 p-4">
              <p className="text-sm font-semibold text-foreground">
                {dictionary.previewSalesInsightsTitle}
              </p>
              <ul className="mt-4 space-y-3">
                {dictionary.previewSalesInsightItems.map((item, index) => (
                  <li
                    className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/85 p-3"
                    key={item}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-sm text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
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
  const problemCards: ProblemCard[] = [
    {
      title: dictionary.problemCardOneTitle,
      description: dictionary.problemCardOneDescription,
      icon: <ReviewsIcon />,
    },
    {
      title: dictionary.problemCardTwoTitle,
      description: dictionary.problemCardTwoDescription,
      icon: <SentimentIcon />,
    },
    {
      title: dictionary.problemCardThreeTitle,
      description: dictionary.problemCardThreeDescription,
      icon: <DashboardIcon />,
    },
  ];

  const features: FeatureCard[] = [
    {
      title: dictionary.featureOneTitle,
      description: dictionary.featureOneDescription,
      icon: <ReviewsIcon />,
    },
    {
      title: dictionary.featureTwoTitle,
      description: dictionary.featureTwoDescription,
      icon: <SentimentIcon />,
    },
    {
      title: dictionary.featureThreeTitle,
      description: dictionary.featureThreeDescription,
      icon: <UploadIcon />,
    },
    {
      title: dictionary.featureFourTitle,
      description: dictionary.featureFourDescription,
      icon: <DashboardIcon />,
    },
    {
      title: dictionary.featureFiveTitle,
      description: dictionary.featureFiveDescription,
      icon: <ReportIcon />,
    },
  ];

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
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <Link
            className="text-lg font-extrabold tracking-[-0.03em] text-foreground"
            href={homeHref}
          >
            OwnerMate
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <a className="text-sm font-medium text-muted transition hover:text-foreground" href="#solution">
              {dictionary.navProduct}
            </a>
            <a className="text-sm font-medium text-muted transition hover:text-foreground" href="#features">
              {dictionary.navFeatures}
            </a>
            <a className="text-sm font-medium text-muted transition hover:text-foreground" href="#how-it-works">
              {dictionary.navHowItWorks}
            </a>
            <a className="text-sm font-medium text-muted transition hover:text-foreground" href="#insights">
              {dictionary.navInsights}
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher common={common} locale={locale} />
            <ThemeToggle common={common} />
            <CtaLink
              className="hidden sm:inline-flex"
              href={signInHref}
              secondary
            >
              {auth.signIn}
            </CtaLink>
            <CtaLink href={signUpHref}>{auth.signUp}</CtaLink>
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col items-center px-5 pb-20 pt-16 text-center sm:px-6 sm:pt-24 lg:px-8 lg:pb-28">
        <span className="rounded-full border border-primary/15 bg-primary/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {dictionary.heroEyebrow}
        </span>
        <h1 className="mt-8 max-w-5xl text-balance text-4xl font-extrabold text-foreground sm:text-5xl lg:text-6xl">
          {dictionary.heroTitle}
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-muted sm:text-xl">
          {dictionary.heroDescription}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <CtaLink className="min-w-[10rem]" href={signInHref} secondary>
            {auth.signIn}
          </CtaLink>
          <CtaLink className="min-w-[10rem]" href={signUpHref}>
            {auth.signUp}
          </CtaLink>
        </div>
      </section>

      <section className="bg-surface-low py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <SectionHeading
            title={dictionary.problemTitle}
            description={dictionary.problemDescription}
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {problemCards.map((card) => (
              <article
                className="panel rounded-[24px] border border-border/75 p-6"
                key={card.title}
              >
                <CircleIcon>{card.icon}</CircleIcon>
                <h3 className="mt-5 text-xl font-semibold text-foreground">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 lg:py-28" id="solution">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {dictionary.solutionEyebrow}
            </span>
            <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold text-foreground sm:text-4xl">
              {dictionary.solutionTitle}
            </h2>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
              {dictionary.solutionDescription}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[dictionary.solutionPointOne, dictionary.solutionPointTwo, dictionary.solutionPointThree, dictionary.solutionPointFour].map(
              (item, index) => (
                <div
                  className="soft-panel rounded-[24px] border border-border/75 p-5"
                  key={item}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                    0{index + 1}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-foreground">{item}</p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="bg-surface-low py-20 sm:py-24 lg:py-28" id="features">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={dictionary.featuresEyebrow}
            title={dictionary.featuresTitle}
            description={dictionary.featuresDescription}
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                className="panel rounded-[24px] border border-border/75 p-6"
                key={feature.title}
              >
                <CircleIcon>{feature.icon}</CircleIcon>
                <h3 className="mt-5 text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 lg:py-28" id="how-it-works">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={dictionary.howItWorksEyebrow}
            title={dictionary.howItWorksTitle}
            description={dictionary.howItWorksDescription}
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                className="soft-panel relative rounded-[24px] border border-border/75 p-6"
                key={step.title}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                    0{index + 1}
                  </span>
                  {index < steps.length - 1 ? (
                    <span
                      className={cn(
                        "hidden text-primary/60 lg:inline-flex",
                        locale === "ar" && "rotate-180"
                      )}
                    >
                      <FlowArrowIcon />
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="pb-20 pt-4 sm:pb-24 lg:pb-28 lg:pt-6">
        <DashboardPreview dictionary={dictionary} />
      </div>

      <section className="bg-primary-container py-20 text-center text-white sm:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="text-balance text-3xl font-semibold sm:text-4xl">
            {dictionary.finalCtaTitle}
          </h2>
          <p className="mt-5 text-base text-white/72 sm:text-lg">
            {dictionary.finalCtaDescription}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <CtaLink
              className="min-w-[10rem] border border-white/90 bg-white !text-slate-950 shadow-none hover:bg-white hover:!text-slate-950 hover:brightness-95"
              href={signInHref}
            >
              {auth.signIn}
            </CtaLink>
            <CtaLink
              className="min-w-[10rem] border-white/20 bg-white/8 text-white hover:bg-white/14"
              href={signUpHref}
              secondary
            >
              {auth.signUp}
            </CtaLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="font-semibold text-foreground">OwnerMate</p>
            <p className="mt-1">{dictionary.footerNote}</p>
          </div>
          <div className="flex items-center gap-4">
            <a className="transition hover:text-foreground" href="#solution">
              {dictionary.navProduct}
            </a>
            <a className="transition hover:text-foreground" href="#features">
              {dictionary.navFeatures}
            </a>
            <a className="transition hover:text-foreground" href="#how-it-works">
              {dictionary.navHowItWorks}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
