import { PromptGenerator } from "./prompt-generator";
import { requireSuperAdmin } from "@/lib/admin/auth";

export default async function AdminAiPromptsPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Instagram AI prompts</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Generate Instagram post content and image prompts in one pack — captions, hashtags, ideas, plus detailed prompts for
          Gemini and other image tools. Tuned for 2D, illustrated, non-photorealistic veterinary creatives.
        </p>
      </div>

      <PromptGenerator />
    </div>
  );
}
