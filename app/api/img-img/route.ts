import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_AI_KEY,
});

async function generateImg2Img(imageUrl: string, prompt: string) {
  const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
    input: {
      image_url: imageUrl,
      prompt: prompt,
    },
    logs: true,
  });

  return result;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.FAL_AI_KEY) {
      throw new Error("Fal.ai API key not configured");
    }

    const { imageUrl, prompt } = await req.json();

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: "Image URL and prompt are required" },
        { status: 400 }
      );
    }

    const result = await generateImg2Img(imageUrl, prompt);

    return NextResponse.json({
      status: "completed",
      output: result.data.images.map((img) => img.url),
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
