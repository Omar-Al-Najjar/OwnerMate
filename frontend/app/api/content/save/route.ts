import { NextResponse } from "next/server";
import { BackendRouteError, fetchBackendJson, getBackendAuthContext } from "@/lib/api/server";

type SavedGeneratedContentResult = {
  generated_content: {
    id: string;
    generated_text: string;
    edited_text: string | null;
  };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      contentId: string;
      editedText: string;
    };
    const { headers } = await getBackendAuthContext();

    const result = await fetchBackendJson<SavedGeneratedContentResult>(
      "/content/save",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          content_id: payload.contentId,
          edited_text: payload.editedText,
        }),
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.generated_content.id,
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
          message: "Saving generated content failed.",
        },
      },
      { status: 500 }
    );
  }
}
