"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type AttachmentRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  file_name: string | null;
};

export function useVisitPhonePhotoSync({
  visitId,
  clinicId,
  enabled,
  onImageFile,
}: {
  visitId: string;
  clinicId: string;
  enabled: boolean;
  onImageFile: (file: File) => void | Promise<void>;
}) {
  const processedIds = useRef<Set<string>>(new Set());
  const onImageFileRef = useRef(onImageFile);
  onImageFileRef.current = onImageFile;

  const ingestAttachment = useCallback(async (row: AttachmentRow, options?: { skipProcessedCheck?: boolean }) => {
    if (!row.mime_type?.startsWith("image/")) return;
    if (!options?.skipProcessedCheck && processedIds.current.has(row.id)) return;
    processedIds.current.add(row.id);

    const supabase = createClient();
    const { data } = await supabase.storage.from("medical-files").createSignedUrl(row.storage_path, 3600);
    if (!data?.signedUrl) return;

    const res = await fetch(data.signedUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    const file = new File([blob], row.file_name ?? "phone-capture.jpg", {
      type: blob.type || "image/jpeg",
    });
    await onImageFileRef.current(file);
  }, []);

  const checkLatestAttachment = useCallback(async () => {
    if (!enabled) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("file_attachments")
      .select("id, storage_path, mime_type, file_name, created_at")
      .eq("visit_id", visitId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const row of (data ?? []) as AttachmentRow[]) {
      if (!row.mime_type?.startsWith("image/")) continue;
      if (!processedIds.current.has(row.id)) {
        await ingestAttachment(row);
        return;
      }
    }
  }, [clinicId, enabled, ingestAttachment, visitId]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("file_attachments")
        .select("id")
        .eq("visit_id", visitId)
        .eq("clinic_id", clinicId);
      if (!cancelled) {
        for (const row of data ?? []) {
          processedIds.current.add(row.id as string);
        }
      }
    })();

    const channel = supabase
      .channel(`visit-photo-sheet-${visitId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "file_attachments",
          filter: `visit_id=eq.${visitId}`,
        },
        (payload) => {
          const row = payload.new as AttachmentRow;
          void ingestAttachment(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [visitId, clinicId, enabled, ingestAttachment]);

  return { checkLatestAttachment };
}
