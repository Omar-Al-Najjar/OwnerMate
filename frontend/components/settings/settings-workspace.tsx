"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/components/providers/profile-provider";
import { Button } from "@/components/forms/button";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { getPasswordValidationIssues } from "@/lib/auth/password-validation";
import { getNameValidationIssue } from "@/lib/validation/name-validation";
import { cn } from "@/lib/utils/cn";
import type { SettingsPayload, ThemePreference } from "@/types/settings";

type SettingsWorkspaceProps = {
  settings: SettingsPayload;
  dictionary: {
    common: {
      light: string;
      dark: string;
      status: string;
      system: string;
    };
    languageNames: {
      en: string;
      ar: string;
    };
    settings: {
      languagePreference: string;
      themePreference: string;
      profileTitle: string;
      accountTitle: string;
      fullNameLabel: string;
      emailLabel: string;
      roleLabel: string;
      saveButton: string;
      imageLabel: string;
      imageHint: string;
      uploadImage: string;
      removeImage: string;
      profileIdentity: string;
      workspaceEnvironment: string;
      interfaceMode: string;
      interfaceModeDescription: string;
      systemLanguage: string;
      systemLanguageDescription: string;
      discardButton: string;
      temporaryNote: string;
      updatedLabel: string;
      passwordSection: string;
      passwordDescription: string;
      currentPasswordLabel: string;
      newPasswordLabel: string;
      passwordAction: string;
      emailReadOnlyHint: string;
      passwordPlaceholderHint: string;
      passwordStrengthHint: string;
      passwordWeakError: string;
      passwordReuseError: string;
      nameLengthError: string;
      salesSection: string;
      salesDescription: string;
      salesDateLabel: string;
      salesRevenueLabel: string;
      salesOrdersLabel: string;
      salesRefundCountLabel: string;
      salesRefundValueLabel: string;
      salesWalkInLabel: string;
      salesDeliveryLabel: string;
      salesInstagramLabel: string;
      salesWhatsappLabel: string;
      salesSaveButton: string;
      salesUpdatedLabel: string;
      salesRecentTitle: string;
      salesEmptyLabel: string;
      googleImportSection: string;
      googleImportDescription: string;
      businessNameInputLabel: string;
      businessNameInputHint: string;
      googleImportSaveHint: string;
      googleImportButton: string;
      googleImportSavingLabel: string;
      googleImportRunningLabel: string;
      googleImportSuccessLabel: string;
      googleImportEmptyLabel: string;
      googleImportDuplicateOnlyLabel: string;
      googleImportErrorLabel: string;
      googleImportResultImported: string;
      googleImportResultDuplicates: string;
      googleImportChoosePlaceLabel: string;
      googleImportConfirmPlaceButton: string;
    };
  };
};

type SalesRecordSummary = {
  id: string;
  record_date: string;
  revenue: number;
  orders: number;
  refund_count: number;
  refund_value: number;
};

type ThemeHandle = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

type GoogleImportCandidate = {
  candidateId: string;
  title: string;
  category: string | null;
  address: string | null;
  reviewCount: number | null;
  reviewRating: number | null;
  placeId: string | null;
  link: string | null;
};

type GoogleImportJobStatus = "queued" | "running" | "needs_selection" | "success" | "failed";

type GoogleImportJob = {
  id: string;
  status: GoogleImportJobStatus;
  businessName: string;
  providerStatus: string | null;
  message: string;
  importedCount: number | null;
  duplicateCount: number | null;
  processedCount: number | null;
  candidates: GoogleImportCandidate[];
  selectedCandidateId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

const FULL_NAME_MAX_LENGTH = 25;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "OM";
}

function SettingsSectionHeader({
  index,
  title,
}: {
  index: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="inline-flex rounded-lg bg-surface-high px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-muted ring-1 ring-inset ring-border/70">
        {index}
      </span>
      <h2 className="font-display text-2xl font-bold tracking-[-0.045em] text-foreground sm:text-[1.9rem]">
        {title}
      </h2>
    </div>
  );
}

function GooglePinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21c4.2-4.3 6.3-7.7 6.3-10.3a6.3 6.3 0 1 0-12.6 0C5.7 13.3 7.8 16.7 12 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10.7" r="2.7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function SettingsWorkspace({
  settings,
  dictionary,
}: SettingsWorkspaceProps) {
  const { profile, updateProfile } = useProfile();
  const [language, setLanguage] = useState(settings.locale);
  const [theme, setTheme] = useState<ThemePreference>(settings.theme);
  const [fullName, setFullName] = useState(profile.fullName);
  const [googleReviewBusinessName, setGoogleReviewBusinessName] = useState(
    settings.business.googleReviewBusinessName
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordNoticeTone, setPasswordNoticeTone] = useState<
    "default" | "error" | "success"
  >("default");
  const [saveNotice, setSaveNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [salesDate, setSalesDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [salesRevenue, setSalesRevenue] = useState("0");
  const [salesOrders, setSalesOrders] = useState("0");
  const [salesRefundCount, setSalesRefundCount] = useState("0");
  const [salesRefundValue, setSalesRefundValue] = useState("0");
  const [salesWalkInRevenue, setSalesWalkInRevenue] = useState("0");
  const [salesDeliveryRevenue, setSalesDeliveryRevenue] = useState("0");
  const [salesInstagramRevenue, setSalesInstagramRevenue] = useState("0");
  const [salesWhatsappRevenue, setSalesWhatsappRevenue] = useState("0");
  const [salesNotice, setSalesNotice] = useState("");
  const [isSavingSales, setIsSavingSales] = useState(false);
  const [recentSales, setRecentSales] = useState<SalesRecordSummary[]>([]);
  const [googleImportNotice, setGoogleImportNotice] = useState("");
  const [googleImportJob, setGoogleImportJob] = useState<GoogleImportJob | null>(null);
  const [selectedGoogleCandidateId, setSelectedGoogleCandidateId] = useState("");
  const themeInitializedRef = useRef(false);

  useEffect(() => {
    const handle = (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
      .__OWNERMATE_THEME__;

    if (!themeInitializedRef.current) {
      themeInitializedRef.current = true;
      if (handle?.theme) {
        setTheme(handle.theme);
      }
      return;
    }

    if (handle && handle.theme !== theme) {
      handle.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    setFullName(profile.fullName);
  }, [profile.fullName]);

  useEffect(() => {
    setGoogleReviewBusinessName(settings.business.googleReviewBusinessName);
  }, [settings.business.googleReviewBusinessName]);

  useEffect(() => {
    let isMounted = true;

    async function loadSales() {
      const response = await fetch("/api/sales", {
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: SalesRecordSummary[];
          }
        | null;

      if (!isMounted || !response.ok || !body?.success || !body.data) {
        return;
      }

      setRecentSales(body.data.slice().reverse().slice(0, 5));
    }

    void loadSales();

    return () => {
      isMounted = false;
    };
  }, []);

  const initials = useMemo(() => getInitials(fullName), [fullName]);

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateProfile({ avatarUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSave = async () => {
    if (getNameValidationIssue(fullName, { maxLength: FULL_NAME_MAX_LENGTH }) !== null) {
      setSaveNotice(dictionary.settings.nameLengthError);
      return;
    }

    setIsSaving(true);
    setSaveNotice("");

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          language,
          theme,
          googleReviewBusinessName,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              fullName?: string | null;
              locale?: "en" | "ar" | null;
              theme?: ThemePreference | null;
              business?: {
                id: string;
                name: string;
                googleReviewBusinessName: string;
              } | null;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !body?.success) {
        setSaveNotice(body?.error?.message ?? dictionary.settings.temporaryNote);
        return;
      }

      updateProfile({
        fullName: body.data?.fullName ?? fullName,
      });
      if (body.data?.locale) {
        setLanguage(body.data.locale);
      }
      if (body.data?.theme) {
        setTheme(body.data.theme);
      }
      if (body.data?.business) {
        setGoogleReviewBusinessName(body.data.business.googleReviewBusinessName);
      }
      setSaveNotice(dictionary.settings.updatedLabel);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordNotice(dictionary.settings.passwordPlaceholderHint);
      setPasswordNoticeTone("error");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordNotice(dictionary.settings.passwordReuseError);
      setPasswordNoticeTone("error");
      return;
    }

    if (getPasswordValidationIssues(newPassword).length > 0) {
      setPasswordNotice(dictionary.settings.passwordWeakError);
      setPasswordNoticeTone("error");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordNotice("");
    setPasswordNoticeTone("default");

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: {
              code?: string;
              message?: string;
            };
          }
        | null;

      if (!response.ok || !body?.success) {
        setPasswordNotice(
          body?.error?.code === "WEAK_PASSWORD"
            ? dictionary.settings.passwordWeakError
            : body?.error?.code === "PASSWORD_REUSE_NOT_ALLOWED"
              ? dictionary.settings.passwordReuseError
              : body?.error?.message ??
                dictionary.settings.passwordPlaceholderHint
        );
        setPasswordNoticeTone("error");
        return;
      }

      setPasswordNotice(dictionary.settings.updatedLabel);
      setPasswordNoticeTone("success");
      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDiscard = () => {
    setLanguage(settings.locale);
    setTheme(settings.theme);
    setFullName(profile.fullName);
    setGoogleReviewBusinessName(settings.business.googleReviewBusinessName);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordNotice("");
    setPasswordNoticeTone("default");
    setSaveNotice("");
    setGoogleImportNotice("");
    setGoogleImportJob(null);
    setSelectedGoogleCandidateId("");
  };

  useEffect(() => {
    if (!googleImportJob || !["queued", "running"].includes(googleImportJob.status)) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/reviews/import/google/${googleImportJob.id}`, {
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              job?: GoogleImportJob;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !body?.success || !body.data?.job) {
        setGoogleImportNotice(
          body?.error?.message ?? dictionary.settings.googleImportErrorLabel
        );
        setGoogleImportJob((current) =>
          current
            ? {
                ...current,
                status: "failed",
              }
            : current
        );
        return;
      }

      const nextJob = body.data.job;
      setGoogleImportJob(nextJob);
      setGoogleImportNotice(nextJob.message);
      setSelectedGoogleCandidateId(
        nextJob.selectedCandidateId ?? nextJob.candidates[0]?.candidateId ?? ""
      );

      if (nextJob.status === "success") {
        const importedCount = nextJob.importedCount ?? 0;
        const duplicateCount = nextJob.duplicateCount ?? 0;

        if (importedCount === 0 && duplicateCount > 0) {
          setGoogleImportNotice(
            `${dictionary.settings.googleImportDuplicateOnlyLabel} ${dictionary.settings.googleImportResultDuplicates}: ${duplicateCount}.`
          );
          return;
        }

        if (importedCount === 0) {
          setGoogleImportNotice(dictionary.settings.googleImportEmptyLabel);
          return;
        }

        setGoogleImportNotice(
          `${dictionary.settings.googleImportSuccessLabel} ${dictionary.settings.googleImportResultImported}: ${importedCount}. ${dictionary.settings.googleImportResultDuplicates}: ${duplicateCount}.`
        );
        return;
      }

      if (nextJob.status === "failed") {
        setGoogleImportNotice(nextJob.message);
      }
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [dictionary.settings, googleImportJob]);

  const handleGoogleImport = async () => {
    if (!googleReviewBusinessName.trim()) {
      setGoogleImportNotice(dictionary.settings.googleImportErrorLabel);
      return;
    }

    setGoogleImportNotice("");
    setGoogleImportJob(null);
    setSelectedGoogleCandidateId("");

    try {
      const response = await fetch("/api/reviews/import/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: settings.business.id,
          businessName: googleReviewBusinessName,
          lang: language,
          depth: 1,
          limit: 20,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              job?: GoogleImportJob;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !body?.success) {
        setGoogleImportNotice(
          body?.error?.message ?? dictionary.settings.googleImportErrorLabel
        );
        return;
      }
      if (!body.data?.job) {
        setGoogleImportNotice(dictionary.settings.googleImportErrorLabel);
        return;
      }

      setGoogleImportJob(body.data.job);
      setGoogleImportNotice(body.data.job.message);
      setSelectedGoogleCandidateId(
        body.data.job.selectedCandidateId ?? body.data.job.candidates[0]?.candidateId ?? ""
      );
    } catch {
      setGoogleImportNotice(dictionary.settings.googleImportErrorLabel);
    }
  };

  const handleGoogleCandidateSelection = async () => {
    if (!googleImportJob || !selectedGoogleCandidateId.trim()) {
      return;
    }

    setGoogleImportNotice("");

    try {
      const response = await fetch(
        `/api/reviews/import/google/${googleImportJob.id}/selection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: selectedGoogleCandidateId,
          }),
        }
      );

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              job?: GoogleImportJob;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !body?.success || !body.data?.job) {
        setGoogleImportNotice(
          body?.error?.message ?? dictionary.settings.googleImportErrorLabel
        );
        return;
      }

      setGoogleImportJob(body.data.job);
      setGoogleImportNotice(body.data.job.message);
      setSelectedGoogleCandidateId(body.data.job.selectedCandidateId ?? selectedGoogleCandidateId);
    } catch {
      setGoogleImportNotice(dictionary.settings.googleImportErrorLabel);
    }
  };

  const isImportingGoogleReviews =
    googleImportJob?.status === "queued" || googleImportJob?.status === "running";

  const handleSalesSave = async () => {
    setIsSavingSales(true);
    setSalesNotice("");

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordDate: salesDate,
          revenue: Number(salesRevenue) || 0,
          orders: Number(salesOrders) || 0,
          refundCount: Number(salesRefundCount) || 0,
          refundValue: Number(salesRefundValue) || 0,
          walkInRevenue: Number(salesWalkInRevenue) || 0,
          deliveryAppRevenue: Number(salesDeliveryRevenue) || 0,
          instagramDmRevenue: Number(salesInstagramRevenue) || 0,
          whatsappRevenue: Number(salesWhatsappRevenue) || 0,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: SalesRecordSummary;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !body?.success || !body.data) {
        setSalesNotice(body?.error?.message ?? dictionary.settings.temporaryNote);
        return;
      }

      setRecentSales((current) =>
        [body.data!, ...current.filter((record) => record.id !== body.data!.id)].slice(
          0,
          5
        )
      );
      setSalesNotice(dictionary.settings.salesUpdatedLabel);
    } finally {
      setIsSavingSales(false);
    }
  };

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <SettingsSectionHeader
          index="01/"
          title={dictionary.settings.profileIdentity}
        />
        <div className="soft-panel p-6 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_220px_220px]">
            <div className="space-y-5">
              <Input
                label={dictionary.settings.fullNameLabel}
                maxLength={FULL_NAME_MAX_LENGTH}
                onChange={(event) => setFullName(event.target.value)}
                value={fullName}
              />
              <div className="space-y-2 text-start">
                <label className="block space-y-2 text-start">
                  <span className="text-sm font-medium text-foreground">
                    {dictionary.settings.emailLabel}
                  </span>
                  <div className="w-full rounded-2xl border border-border/70 bg-surface-low px-4 py-3 text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                    {profile.email}
                  </div>
                </label>
                <p className="text-sm text-muted">
                  {dictionary.settings.emailReadOnlyHint}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-start">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
                {dictionary.settings.imageLabel}
              </p>
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-surface-high text-3xl font-semibold text-primary">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={fullName}
                    className="h-full w-full object-cover"
                    src={profile.avatarUrl}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <p className="text-sm leading-6 text-muted">
                {dictionary.settings.imageHint}
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-low">
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                    type="file"
                  />
                  {dictionary.settings.uploadImage}
                </label>
                {profile.avatarUrl ? (
                  <Button
                    variant="secondary"
                    onClick={() => updateProfile({ avatarUrl: "" })}
                    type="button"
                  >
                    {dictionary.settings.removeImage}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 text-start">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
                {dictionary.settings.roleLabel}
              </p>
              <div className="inline-flex rounded-lg bg-gradient-to-br from-sidebar to-primary-container px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-panel">
                {settings.profile.role}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SettingsSectionHeader
          index="02/"
          title={dictionary.settings.workspaceEnvironment}
        />
        <div className="grid gap-5">
          <div className="soft-panel p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl text-start">
                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  {dictionary.settings.interfaceMode}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {dictionary.settings.interfaceModeDescription}
                </p>
              </div>
              <div className="inline-flex rounded-2xl bg-surface-low p-1 ring-1 ring-inset ring-border/70">
                {[
                  { label: dictionary.common.light, value: "light" },
                  { label: dictionary.common.dark, value: "dark" },
                  { label: dictionary.common.system, value: "system" },
                ].map((option) => {
                  const isActive = theme === option.value;

                  return (
                    <button
                      key={option.value}
                      className={cn(
                        "rounded-xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition",
                        isActive
                          ? "bg-card text-foreground shadow-panel"
                          : "text-muted hover:bg-card/70 hover:text-foreground"
                      )}
                      onClick={() => setTheme(option.value as ThemePreference)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="soft-panel p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl text-start">
                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  {dictionary.settings.systemLanguage}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {dictionary.settings.systemLanguageDescription}
                </p>
              </div>
              <div className="w-full max-w-xs">
                <Select
                  label={dictionary.settings.languagePreference}
                  onChange={(event) =>
                    setLanguage(event.target.value as "en" | "ar")
                  }
                  options={[
                    { label: dictionary.languageNames.en, value: "en" },
                    { label: dictionary.languageNames.ar, value: "ar" },
                  ]}
                  value={language}
                />
              </div>
            </div>
          </div>

          <div className="soft-panel p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl text-start">
                <div className="inline-flex items-center gap-2 rounded-full bg-surface-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted ring-1 ring-inset ring-border/70">
                  <GooglePinIcon />
                  Google
                </div>
                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  {dictionary.settings.googleImportSection}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {dictionary.settings.googleImportDescription}
                </p>
              </div>
              <div className="w-full max-w-2xl space-y-4">
                <Input
                  label={dictionary.settings.businessNameInputLabel}
                  onChange={(event) =>
                    setGoogleReviewBusinessName(event.target.value)
                  }
                  placeholder={settings.business.name}
                  value={googleReviewBusinessName}
                />
                <p className="-mt-1 text-sm text-muted">
                  {dictionary.settings.businessNameInputHint}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-low px-4 py-4 ring-1 ring-inset ring-border/70">
                  <p className="max-w-xl text-sm text-muted">
                    {googleImportJob?.status === "queued"
                      ? googleImportJob.message
                      : googleImportJob?.status === "running"
                        ? googleImportJob.message
                        : dictionary.settings.googleImportSaveHint}
                  </p>
                  <Button
                    disabled={isImportingGoogleReviews}
                    onClick={handleGoogleImport}
                    type="button"
                  >
                    {isImportingGoogleReviews
                      ? dictionary.settings.googleImportRunningLabel
                      : dictionary.settings.googleImportButton}
                  </Button>
                </div>
                {googleImportNotice ? (
                  <p className="text-sm text-muted">{googleImportNotice}</p>
                ) : null}
                {googleImportJob?.status === "needs_selection" &&
                googleImportJob.candidates.length > 0 ? (
                  <div className="space-y-3 rounded-2xl bg-surface-low px-4 py-4 ring-1 ring-inset ring-border/70">
                    <p className="text-sm font-medium text-foreground">
                      {dictionary.settings.googleImportChoosePlaceLabel}
                    </p>
                    <div className="space-y-2">
                      {googleImportJob.candidates.map((candidate) => (
                        <label
                          key={candidate.candidateId}
                          className="flex cursor-pointer items-start gap-3 rounded-xl bg-card px-3 py-3 text-sm text-foreground ring-1 ring-inset ring-border/70"
                        >
                          <input
                            checked={selectedGoogleCandidateId === candidate.candidateId}
                            name="google-import-candidate"
                            onChange={() =>
                              setSelectedGoogleCandidateId(candidate.candidateId)
                            }
                            type="radio"
                            value={candidate.candidateId}
                          />
                          <span className="space-y-1">
                            <span className="block font-medium">{candidate.title}</span>
                            {candidate.category ? (
                              <span className="block text-muted">{candidate.category}</span>
                            ) : null}
                            {candidate.address ? (
                              <span className="block text-muted">{candidate.address}</span>
                            ) : null}
                            {candidate.reviewRating !== null ||
                            candidate.reviewCount !== null ? (
                              <span className="block text-muted">
                                Rating: {candidate.reviewRating ?? "n/a"} | Reviews:{" "}
                                {candidate.reviewCount ?? 0}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Button
                      disabled={!selectedGoogleCandidateId.trim()}
                      onClick={handleGoogleCandidateSelection}
                      type="button"
                    >
                      {dictionary.settings.googleImportConfirmPlaceButton}
                    </Button>
                  </div>
                ) : null}
                {googleImportJob ? (
                  <div className="rounded-2xl bg-surface-low px-4 py-4 text-sm text-muted ring-1 ring-inset ring-border/70">
                    <p>
                      {dictionary.common.status}: {googleImportJob.status}
                    </p>
                    {googleImportJob.providerStatus ? (
                      <p>Provider: {googleImportJob.providerStatus}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="soft-panel p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl text-start">
                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  {dictionary.settings.salesSection}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {dictionary.settings.salesDescription}
                </p>
              </div>
              <div className="w-full space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Input
                    label={dictionary.settings.salesDateLabel}
                    onChange={(event) => setSalesDate(event.target.value)}
                    type="date"
                    value={salesDate}
                  />
                  <Input
                    label={dictionary.settings.salesRevenueLabel}
                    min="0"
                    onChange={(event) => setSalesRevenue(event.target.value)}
                    type="number"
                    value={salesRevenue}
                  />
                  <Input
                    label={dictionary.settings.salesOrdersLabel}
                    min="0"
                    onChange={(event) => setSalesOrders(event.target.value)}
                    type="number"
                    value={salesOrders}
                  />
                  <Input
                    label={dictionary.settings.salesRefundCountLabel}
                    min="0"
                    onChange={(event) => setSalesRefundCount(event.target.value)}
                    type="number"
                    value={salesRefundCount}
                  />
                  <Input
                    label={dictionary.settings.salesRefundValueLabel}
                    min="0"
                    onChange={(event) => setSalesRefundValue(event.target.value)}
                    type="number"
                    value={salesRefundValue}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Input
                    label={dictionary.settings.salesWalkInLabel}
                    min="0"
                    onChange={(event) => setSalesWalkInRevenue(event.target.value)}
                    type="number"
                    value={salesWalkInRevenue}
                  />
                  <Input
                    label={dictionary.settings.salesDeliveryLabel}
                    min="0"
                    onChange={(event) => setSalesDeliveryRevenue(event.target.value)}
                    type="number"
                    value={salesDeliveryRevenue}
                  />
                  <Input
                    label={dictionary.settings.salesInstagramLabel}
                    min="0"
                    onChange={(event) => setSalesInstagramRevenue(event.target.value)}
                    type="number"
                    value={salesInstagramRevenue}
                  />
                  <Input
                    label={dictionary.settings.salesWhatsappLabel}
                    min="0"
                    onChange={(event) => setSalesWhatsappRevenue(event.target.value)}
                    type="number"
                    value={salesWhatsappRevenue}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {salesNotice ? (
                    <p className="text-sm text-muted">{salesNotice}</p>
                  ) : (
                    <span />
                  )}
                  <Button
                    disabled={isSavingSales}
                    onClick={handleSalesSave}
                    type="button"
                  >
                    {dictionary.settings.salesSaveButton}
                  </Button>
                </div>

                <div className="space-y-3 rounded-2xl bg-surface-low p-4 ring-1 ring-inset ring-border/70">
                  <p className="text-sm font-semibold text-foreground">
                    {dictionary.settings.salesRecentTitle}
                  </p>
                  {recentSales.length === 0 ? (
                    <p className="text-sm text-muted">
                      {dictionary.settings.salesEmptyLabel}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentSales.map((record) => (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-inset ring-border/70"
                          key={record.id}
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {record.record_date}
                            </p>
                            <p className="text-muted">
                              {dictionary.settings.salesRevenueLabel}: {record.revenue} |{" "}
                              {dictionary.settings.salesOrdersLabel}: {record.orders}
                            </p>
                          </div>
                          <p className="text-muted">
                            {dictionary.settings.salesRefundValueLabel}:{" "}
                            {record.refund_value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="soft-panel p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl text-start">
                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  {dictionary.settings.passwordSection}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {dictionary.settings.passwordDescription}
                </p>
              </div>
              <div className="w-full max-w-xl space-y-4">
                <Input
                  label={dictionary.settings.currentPasswordLabel}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setPasswordNotice("");
                    setPasswordNoticeTone("default");
                  }}
                  type="password"
                  value={currentPassword}
                />
                <Input
                  label={dictionary.settings.newPasswordLabel}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordNotice("");
                    setPasswordNoticeTone("default");
                  }}
                  type="password"
                  value={newPassword}
                />
                <p
                  className={cn(
                    "text-sm",
                    passwordNoticeTone === "error"
                      ? "text-red-600"
                      : passwordNoticeTone === "success"
                        ? "text-emerald-700"
                        : "text-muted"
                  )}
                >
                  {passwordNotice || dictionary.settings.passwordStrengthHint}
                </p>
                <Button
                  disabled={isUpdatingPassword}
                  onClick={handlePasswordChange}
                  type="button"
                >
                  {dictionary.settings.passwordAction}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        {saveNotice ? (
          <p className="self-center text-sm text-muted">{saveNotice}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={handleDiscard}
            type="button"
          >
            {dictionary.settings.discardButton}
          </Button>
          <Button disabled={isSaving} onClick={handleSave} type="button">
            {isSaving
              ? dictionary.settings.googleImportSavingLabel
              : dictionary.settings.saveButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
