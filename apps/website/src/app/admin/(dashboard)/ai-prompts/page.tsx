import { PromptGenerator } from "./prompt-generator";
import { requireSuperAdmin } from "@/lib/admin/auth";

export default async function AdminAiPromptsPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Instagram AI prompts</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Generate DeepSeek R1 powered Instagram post ideas for illustrated veterinary content, then jump into Gemini to
          create the final visual. This tool is tuned for 2D, drawn, non-realistic posts rather than photo-style outputs.
        </p>
      </div>

      <PromptGenerator />
    </div>
  );
}
