"use client";

import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/providers/profile-provider";
import { Button } from "@/components/forms/button";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { cn } from "@/lib/utils/cn";
import type { SettingsPayload, ThemePreference } from "@/types/settings";

type SettingsWorkspaceProps = {
  settings: SettingsPayload;
  dictionary: {
    common: {
      light: string;
      dark: string;
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
    };
  };
};

type ThemeHandle = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

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
      <span className="text-sm font-medium tracking-[0.16em] text-muted">
        {index}
      </span>
      <h2 className="text-2xl font-semibold uppercase tracking-[0.14em] text-foreground">
        {title}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  useEffect(() => {
    const handle = (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
      .__OWNERMATE_THEME__;
    if (handle) {
      handle.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    setFullName(profile.fullName);
  }, [profile.fullName]);

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

  const handleSave = () => {
    updateProfile({
      fullName,
    });
  };

  const handlePasswordChange = () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordNotice(dictionary.settings.passwordPlaceholderHint);
      return;
    }

    setPasswordNotice(dictionary.settings.updatedLabel);
    setCurrentPassword("");
    setNewPassword("");
  };

  const handleDiscard = () => {
    setLanguage(settings.locale);
    setTheme(settings.theme);
    setFullName(profile.fullName);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordNotice("");
  };

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <SettingsSectionHeader
          index="01/"
          title={dictionary.settings.profileIdentity}
        />
        <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_220px_220px]">
            <div className="space-y-5">
              <Input
                label={dictionary.settings.fullNameLabel}
                onChange={(event) => setFullName(event.target.value)}
                value={fullName}
              />
              <div className="space-y-2 text-start">
                <label className="block space-y-2 text-start">
                  <span className="text-sm font-medium text-foreground">
                    {dictionary.settings.emailLabel}
                  </span>
                  <div className="w-full rounded-2xl border border-border bg-slate-100 px-4 py-3 text-sm text-slate-500 shadow-inner dark:bg-slate-900 dark:text-slate-400">
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
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface text-3xl font-semibold text-primary dark:text-indigo-200">
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
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface">
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
                    className="bg-surface text-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
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
              <div className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-white dark:bg-slate-100 dark:text-slate-900">
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
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl text-start">
                <h3 className="text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
                  {dictionary.settings.interfaceMode}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {dictionary.settings.interfaceModeDescription}
                </p>
              </div>
              <div className="inline-flex rounded-2xl border border-border bg-surface p-1">
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
                        "rounded-xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] transition",
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
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

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
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

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
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
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  value={currentPassword}
                />
                <Input
                  label={dictionary.settings.newPasswordLabel}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  value={newPassword}
                />
                {passwordNotice ? (
                  <p className="text-sm text-muted">{passwordNotice}</p>
                ) : null}
                <Button onClick={handlePasswordChange} type="button">
                  {dictionary.settings.passwordAction}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap gap-3">
          <Button
            className="border border-border bg-background text-foreground hover:bg-surface"
            onClick={handleDiscard}
            type="button"
          >
            {dictionary.settings.discardButton}
          </Button>
          <Button onClick={handleSave} type="button">
            {dictionary.settings.saveButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
