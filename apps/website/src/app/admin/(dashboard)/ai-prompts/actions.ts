"use server";

import type { InstagramPromptPackFields } from "@saasclinics/lib";
import {
  buildInstagramPromptPackFromTemplate,
  type InstagramPromptFormInput,
} from "@/lib/marketing/build-instagram-prompt-pack";
import { requireAdmin } from "@/lib/admin/auth";

export type InstagramPromptRequest = InstagramPromptFormInput;

export type InstagramPromptPack = InstagramPromptPackFields;

export type GenerateInstagramPromptPackResult =
  | { ok: true; pack: InstagramPromptPack }
  | { ok: false; error: string };

export async function generateInstagramPromptPack(
  input: InstagramPromptRequest,
): Promise<GenerateInstagramPromptPackResult> {
  try {
    await requireAdmin();

    const scene = input.scene?.trim();
    if (!scene) {
      return { ok: false, error: "Describe the scene, animals, or objects for the illustration." };
    }

    const pack = buildInstagramPromptPackFromTemplate({
      ...input,
      scene,
    });

    return { ok: true, pack };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build prompt pack.";
    return { ok: false, error: message };
  }
}
