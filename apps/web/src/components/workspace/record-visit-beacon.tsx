"use client";

import { useEffect } from "react";
import { mergeRecordTab, pushNavHistory, readRecordTabs, writeRecordTabs } from "@/lib/workspace/record-tabs-client";
import type { RecordTabEntry } from "@/lib/workspace/record-tabs-types";

/**
 * Call from patient/contact record pages so the workspace strip picks up label + href
 * (works for client-side navigations, not only full document loads).
 */
export function RecordVisitBeacon({ tab }: { tab: RecordTabEntry }) {
  useEffect(() => {
    const open = readRecordTabs();
    writeRecordTabs(mergeRecordTab(open, tab));
    pushNavHistory({ href: tab.href, label: tab.label, kind: tab.kind });
  }, [tab]);

  return null;
}
