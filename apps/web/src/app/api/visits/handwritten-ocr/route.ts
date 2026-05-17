import { recognizeHandwrittenRegionCore } from "@/lib/visits/recognize-handwritten-region-server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Parameters<typeof recognizeHandwrittenRegionCore>[0];
    const result = await recognizeHandwrittenRegionCore(input);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Handwritten OCR request failed.",
      },
      { status: 500 },
    );
  }
}
