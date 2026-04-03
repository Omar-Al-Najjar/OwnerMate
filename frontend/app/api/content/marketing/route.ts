import { NextResponse } from "next/server";
import {
  BackendRouteError,
  fetchBackendJson,
  getBackendAuthContext,
} from "@/lib/api/server";

type GeneratedContentRead = {
  id: string;
  language: string;
  generated_text: string;
  edited_text: string | null;
};

type ContentGenerationResult = {
  generated_content: GeneratedContentRead;
  agent_run_id: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      language: "en" | "ar";
      businessContext: string;
    };
    const { businessId, headers } = await getBackendAuthContext();

    if (!businessId) {
      throw new BackendRouteError(
        "BUSINESS_NOT_FOUND",
        "No business is available for the authenticated user.",
        404
      );
    }

    const result = await fetchBackendJson<ContentGenerationResult>(
      "/content/generate/marketing",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          business_id: businessId,
          language: payload.language,
          tone: "friendly",
          business_context: payload.businessContext,
          prompt_context: {
            source: "frontend_ai_content_workspace",
          },
        }),
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.generated_content.id,
        generatedText: result.generated_content.generated_text,
        editableText:
          result.generated_content.edited_text ??
          result.generated_content.generated_text,
      },
    });
  } catch (error) {
    if (error instanceof BackendRouteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Content generation failed.",
        },
      },
      { status: 500 }
    );
  }
}
