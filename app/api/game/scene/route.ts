import { NextResponse } from "next/server";
import { generateScene } from "@/lib/game/script";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import OpenAI from "openai";
import { Scene, SceneResponse } from "@/lib/types/game";
import { STAMINA_COSTS } from "@/lib/types/game";

async function getUser(token: string) {
  try {
    const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
}

async function generateSceneImages(scene: Scene) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const [backgroundImage, characterImage] = await Promise.all([
      !scene.backgroundImage
        ? openai.images.generate({
            model: "dall-e-3",
            prompt: `Detailed ${
              scene.background || "classroom"
            } setting. High quality anime background art, visual novel style, cinematic wide view, no characters, highly detailed environment, professional lighting, 16:9 aspect ratio.`,
            n: 1,
            size: "1792x1024",
            quality: "hd" as const,
            style: "vivid" as const,
          })
        : null,
      !scene.characterImage
        ? openai.images.generate({
            model: "dall-e-3",
            prompt: `Full body portrait of an anime character hot sexy showing girl ${scene.emotion} emotion. Visual novel style, high quality, transparent background, centered composition, detailed facial features and clothing, professional lighting.`,
            n: 1,
            size: "1024x1024",
            quality: "standard" as const,
            style: "natural" as const,
          })
        : null,
    ]);

    return {
      characterImage: characterImage?.data[0]?.url || null,
      backgroundImage: backgroundImage?.data[0]?.url || null,
    };
  } catch (error) {
    console.error("Failed to generate images:", error);
    return {
      characterImage: null,
      backgroundImage: null,
    };
  }
}

async function checkAndUpdateStamina(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) throw new Error("User not found");

  // Free users need stamina
  if (user.subscription?.type !== "UNLIMITED") {
    if (user.stamina < STAMINA_COSTS.SCENE_GENERATION) {
      throw new Error("Insufficient stamina");
    }

    // Deduct stamina and log usage
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { stamina: user.stamina - STAMINA_COSTS.SCENE_GENERATION },
      }),
      prisma.staminaUsage.create({
        data: {
          userId,
          amount: STAMINA_COSTS.SCENE_GENERATION,
          type: "SCENE_GENERATION",
        },
      }),
    ]);
  }
}

export async function POST(request: Request) {
  try {
    // Auth check
    const token = cookies().get("accessToken")?.value;
    const userId = token ? await getUser(token) : null;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { previousScene, playerChoice } = await request.json();

    // Check stamina before generating new scene
    if (!previousScene) {
      await checkAndUpdateStamina(userId);
    }

    // Check for existing unviewed scene first
    const existingUserScene = await prisma.userScene.findFirst({
      where: {
        userId,
        viewed: false,
      },
      include: {
        scene: true,
      },
    });

    if (existingUserScene?.scene) {
      const scene = existingUserScene.scene;

      // Generate missing images if needed
      if (!scene.characterImage || !scene.backgroundImage) {
        const images = await generateSceneImages(scene);
        const updatedScene = await prisma.scene.update({
          where: { sceneId: scene.sceneId },
          data: images,
        });
        return NextResponse.json({ scene: updatedScene });
      }
      return NextResponse.json({ scene });
    }

    // Generate new scene
    const scene = await generateScene(previousScene, playerChoice);

    // Check for existing scene by sceneId
    const existingScene = await prisma.scene.findUnique({
      where: { sceneId: scene.sceneId },
    });

    if (existingScene) {
      // Create UserScene relation and return existing scene
      await prisma.userScene.create({
        data: {
          userId,
          sceneId: scene.sceneId,
          viewed: false,
        },
      });

      // Generate missing images if needed
      if (!existingScene.characterImage || !existingScene.backgroundImage) {
        const images = await generateSceneImages(existingScene);
        const updatedScene = await prisma.scene.update({
          where: { sceneId: scene.sceneId },
          data: images,
        });
        return NextResponse.json({ scene: updatedScene });
      }
      return NextResponse.json({ scene: existingScene });
    }

    // Create new scene with images
    const images = await generateSceneImages(scene);
    const [newScene] = await prisma.$transaction([
      prisma.scene.create({
        data: {
          sceneId: scene.sceneId,
          character: scene.character,
          emotion: scene.emotion,
          text: scene.text,
          next: scene.next,
          choices: scene.choices,
          context: scene.context,
          requiresAI: scene.requiresAI,
          background: scene.background,
          ...images,
          type: scene.type,
          metadata: scene.metadata,
        },
      }),
      prisma.userScene.create({
        data: {
          userId,
          sceneId: scene.sceneId,
          viewed: false,
        },
      }),
    ]);

    return NextResponse.json({ scene: newScene });
  } catch (error) {
    console.error("Failed to generate scene:", error);
    return NextResponse.json(
      { error: "Failed to generate scene" },
      { status: 500 }
    );
  }
}
