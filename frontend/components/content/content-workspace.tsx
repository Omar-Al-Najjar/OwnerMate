"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/forms/button";
import { GeneratedContentBox } from "@/components/content/generated-content-box";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";

type ContentWorkspaceProps = {
  locale: "en" | "ar";
  dictionary: {
    common: {
      generate: string;
      regenerate: string;
      save: string;
      remove: string;
    };
    aiContent: {
      marketing: string;
      marketingDescription: string;
      marketingInputLabel: string;
      marketingInputPlaceholder: string;
      outputTitle: string;
      marketingOutputTitle: string;
      emptyTitle: string;
      emptyDescription: string;
      errorTitle: string;
      errorDescription: string;
      saveDescription: string;
      copiedDescription: string;
      workspaceDescription: string;
      outputDescription: string;
      imageLabel: string;
      imageHint: string;
      imageEmpty: string;
      uploadImage: string;
    };
  };
};

export function ContentWorkspace({
  locale,
  dictionary,
}: ContentWorkspaceProps) {
  const [marketingInput, setMarketingInput] = useState("");
  const [generated, setGenerated] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");

  const generatedContent = useMemo(() => {
    const imageNote = imagePreview
      ? locale === "ar"
        ? " تم إرفاق صورة مرجعية للمنتج ضمن هذا الطلب."
        : " A product reference image was included with this request."
      : "";

    return locale === "ar"
      ? `اكتشف حلا عمليا يساعدك على إدارة المراجعات وصناعة محتوى واضح. السياق الحالي: ${marketingInput}.${imageNote} ابدأ الآن برسالة قصيرة ومباشرة مناسبة للنشر.`
      : `Discover a practical workspace that helps you manage reviews and create clear content. Current context: ${marketingInput}.${imageNote} Start with a short, publish-ready message.`;
  }, [imagePreview, locale, marketingInput]);

  const handleGenerate = () => {
    if (!marketingInput.trim()) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    window.setTimeout(() => {
      setGenerated(generatedContent);
      setStatus("success");
    }, 450);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="panel space-y-4 p-5">
          <div className="text-start">
            <p className="text-sm font-semibold text-foreground">
              {dictionary.aiContent.marketing}
            </p>
            <p className="mt-1 text-sm text-muted">
              {dictionary.aiContent.workspaceDescription}
            </p>
          </div>
        </div>

        <div className="panel space-y-5 p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_280px]">
            <label className="block space-y-2 text-start">
              <span className="text-sm font-medium text-foreground">
                {dictionary.aiContent.marketingInputLabel}
              </span>
              <textarea
                className="min-h-[220px] w-full resize-none rounded-2xl border border-border bg-surface px-4 py-4 text-base text-foreground outline-none transition placeholder:text-muted focus:border-primary"
                onChange={(event) => setMarketingInput(event.target.value)}
                placeholder={dictionary.aiContent.marketingInputPlaceholder}
                value={marketingInput}
              />
            </label>

            <div className="space-y-3 text-start">
              <p className="text-sm font-medium text-foreground">
                {dictionary.aiContent.imageLabel}
              </p>
              <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface/70">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={dictionary.aiContent.imageLabel}
                    className="h-full w-full object-cover"
                    src={imagePreview}
                  />
                ) : (
                  <div className="px-4 text-center text-sm text-muted">
                    {dictionary.aiContent.imageEmpty}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted">
                {dictionary.aiContent.imageHint}
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface">
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                    type="file"
                  />
                  {dictionary.aiContent.uploadImage}
                </label>
                {imagePreview ? (
                  <Button
                    className="bg-surface text-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
                    onClick={() => setImagePreview("")}
                    type="button"
                  >
                    {dictionary.common.remove}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGenerate} type="button">
              {status === "success"
                ? dictionary.common.regenerate
                : dictionary.common.generate}
            </Button>

            <Button
              className="bg-surface text-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
              type="button"
            >
              {dictionary.common.save}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="panel p-5 text-start text-sm text-muted">
          <p className="font-semibold text-foreground">
            {dictionary.aiContent.outputTitle}
          </p>
          <p className="mt-1">{dictionary.aiContent.outputDescription}</p>
        </div>

        {status === "idle" ? (
          <EmptyState
            description={dictionary.aiContent.emptyDescription}
            title={dictionary.aiContent.emptyTitle}
          />
        ) : null}
        {status === "loading" ? <LoadingSkeleton /> : null}
        {status === "error" ? (
          <ErrorState
            description={dictionary.aiContent.errorDescription}
            title={dictionary.aiContent.errorTitle}
          />
        ) : null}
        {status === "success" ? (
          <GeneratedContentBox
            content={generated}
            title={dictionary.aiContent.marketingOutputTitle}
          />
        ) : null}
        <div className="panel p-5 text-sm text-muted">
          <p>{dictionary.aiContent.saveDescription}</p>
          <p className="mt-2">{dictionary.aiContent.copiedDescription}</p>
        </div>
      </section>
    </div>
  );
}
