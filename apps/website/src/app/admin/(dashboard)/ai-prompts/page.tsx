import { PromptGenerator } from "./prompt-generator";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminAiPromptsPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Instagram post prompts</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Build Instagram post content and image prompts from a fixed flat-vector template — captions, hashtags, ideas, plus
          ready-to-paste prompts for Gemini and other image tools. No AI call required.
        </p>
      </div>

      <PromptGenerator />
    </div>
  );
}
