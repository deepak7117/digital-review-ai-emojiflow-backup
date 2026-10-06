"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Field";
import {
  startGoogleConnect,
  listAvailableLocationsForPendingConnection,
  finalizeConnection,
  disconnectConnection,
  type ConnectionSummary,
  type AvailableLocation,
} from "@/app/dashboard/settings/google/actions";

export function GoogleConnectionPanel({
  available,
  initialConnections,
  callbackError,
  pendingConnectionId,
}: {
  available: boolean;
  initialConnections: ConnectionSummary[];
  callbackError: string | null;
  pendingConnectionId: string | null;
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [error, setError] = useState<string | null>(callbackError);
  const [connecting, setConnecting] = useState(false);
  const [locations, setLocations] = useState<AvailableLocation[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selecting, setSelecting] = useState<AvailableLocation | null>(null);
  const [branchLabel, setBranchLabel] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    const result = await startGoogleConnect();
    if ("error" in result) {
      setError(result.error);
      setConnecting(false);
      return;
    }
    // Full browser redirect to Google's own consent screen — same pattern
    // as the existing customer-facing Google redirect, not a new pattern.
    window.location.href = result.url;
  }

  async function loadLocationsForPending(connectionId: string) {
    setError(null);
    setLoadingLocations(true);
    const result = await listAvailableLocationsForPendingConnection(connectionId);
    setLoadingLocations(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLocations(result.data);
  }

  async function handleFinalize() {
    if (!selecting || !pendingConnectionId) return;
    setError(null);
    setFinalizing(true);
    const result = await finalizeConnection(
      pendingConnectionId,
      selecting.accountName,
      selecting.name,
      selecting.title,
      branchLabel
    );
    setFinalizing(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setConnections((prev) => [
      {
        id: pendingConnectionId,
        branchLabel: branchLabel.trim() || null,
        googleLocationName: selecting.title,
        status: "connected",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setLocations(null);
    setSelecting(null);
    setBranchLabel("");
  }

  async function handleDisconnect(id: string) {
    setError(null);
    setDisconnectingId(id);
    const result = await disconnectConnection(id);
    setDisconnectingId(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: "disconnected" } : c)));
  }

  if (!available) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-sm text-slate">
        Google integration is not configured on this server yet. Your existing
        Google review link keeps working normally in the meantime.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{error}</Alert>}

      {pendingConnectionId && !locations && (
        <div className="rounded-lg border border-verified/25 bg-verified-tint p-5">
          <p className="text-sm text-verified-dark">
            Google authorization succeeded. Choose which location this connects to.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => loadLocationsForPending(pendingConnectionId)}
            loading={loadingLocations}
          >
            Show my Google locations
          </Button>
        </div>
      )}

      {locations && !selecting && (
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
            Select a location
          </p>
          {locations.length === 0 ? (
            <p className="mt-3 text-sm text-slate">
              No Business Profile locations were found for this Google account.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {locations.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => setSelecting(loc)}
                  className="rounded-md border border-border-strong px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:border-verified"
                >
                  <span className="font-medium">{loc.title}</span>
                  {loc.address && <span className="block text-xs text-slate">{loc.address}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selecting && (
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Confirm</p>
          <p className="mt-2 text-sm text-ink">
            Connect <span className="font-medium">{selecting.title}</span>
          </p>
          <div className="mt-3">
            <label className="text-xs text-slate">Branch label (optional)</label>
            <Input
              value={branchLabel}
              onChange={(e) => setBranchLabel(e.target.value)}
              placeholder="e.g. Nashik"
              maxLength={200}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleFinalize} loading={finalizing}>
              Confirm connection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecting(null)} disabled={finalizing}>
              Back
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Connected locations
        </p>
        {connections.filter((c) => c.status !== "pending").length === 0 ? (
          <p className="mt-2 text-sm text-slate">No Google locations connected yet.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {connections
              .filter((c) => c.status !== "pending")
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-border-strong bg-paper-raised p-3.5"
                >
                  <div>
                    <p className="text-sm text-ink">{c.googleLocationName ?? "Unnamed location"}</p>
                    {c.branchLabel && <p className="text-xs text-slate">{c.branchLabel}</p>}
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        c.status === "connected"
                          ? "bg-verified-tint text-verified-dark"
                          : "bg-ink/5 text-slate"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  {c.status === "connected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDisconnect(c.id)}
                      loading={disconnectingId === c.id}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {!pendingConnectionId && (
        <Button size="sm" onClick={handleConnect} loading={connecting} className="w-fit">
          Connect Google Business Profile
        </Button>
      )}
    </div>
  );
}
