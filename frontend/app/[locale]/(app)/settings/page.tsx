import { SectionHeader } from "@/components/common/section-header";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { settingsProfile } from "@/lib/mock/settings";
import type { LocaleParams } from "@/types/i18n";

export default async function SettingsPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <section className="space-y-8">
      <SectionHeader
        description={dictionary.settings.description}
        eyebrow={dictionary.navigation.settings}
        title={dictionary.settings.title}
      />
      <SettingsWorkspace dictionary={dictionary} settings={settingsProfile} />
    </section>
  );
}
