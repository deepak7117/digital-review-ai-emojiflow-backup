"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { syncGoogleReviews } from "@/app/dashboard/reputation/actions";

export function SyncReviewsButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleSync() {
    setError(null);
    setLastResult(null);
    setSyncing(true);
    const result = await syncGoogleReviews();
    setSyncing(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLastResult(`Synced ${result.syncedCount} review${result.syncedCount === 1 ? "" : "s"}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="sm" onClick={handleSync} loading={syncing}>
        Sync Google Reviews
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
      {lastResult && <p className="text-xs text-verified-dark">{lastResult}</p>}
    </div>
  );
}
