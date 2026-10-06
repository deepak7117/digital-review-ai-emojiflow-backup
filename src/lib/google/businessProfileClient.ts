import "server-only";

/**
 * Google Business Profile APIs — Account Management (read-only, for
 * location selection). Verified against current official Google
 * documentation as part of this milestone's inspection: these are real,
 * current endpoints, in the "federated" API structure Google moved to
 * (separate base URLs per function, all still under the mybusiness*
 * domain family). This has NOT been exercised against a live Google
 * account or an approved Google Cloud project in this environment — see
 * the Milestone 1 report.
 *
 * Deliberately does NOT implement review retrieval or reply-posting —
 * out of scope for this milestone per your instructions.
 */

const ACCOUNTS_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";

export interface GoogleAccount {
  name: string; // resource name, e.g. "accounts/123456789"
  accountName: string;
}

export interface GoogleLocation {
  name: string; // resource name, e.g. "locations/987654321"
  title: string;
  address: string | null;
}

async function googleApiGet(url: string, accessToken: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Lists the Business Profile accounts the authenticated user can access. */
export async function listGoogleAccounts(accessToken: string): Promise<GoogleAccount[]> {
  const data = await googleApiGet(`${ACCOUNTS_BASE}/accounts`, accessToken);
  const accounts = (data as { accounts?: unknown[] })?.accounts;
  if (!Array.isArray(accounts)) return [];

  return accounts
    .filter((a): a is { name: string; accountName?: string } => typeof (a as { name?: unknown })?.name === "string")
    .map((a) => ({ name: a.name, accountName: a.accountName ?? a.name }));
}

/** Lists the locations under one Business Profile account. */
export async function listGoogleLocations(accessToken: string, accountName: string): Promise<GoogleLocation[]> {
  const url = `${BUSINESS_INFO_BASE}/${accountName}/locations?readMask=name,title,storefrontAddress`;
  const data = await googleApiGet(url, accessToken);
  const locations = (data as { locations?: unknown[] })?.locations;
  if (!Array.isArray(locations)) return [];

  return locations
    .filter((l): l is { name: string; title?: string; storefrontAddress?: { addressLines?: string[] } } =>
      typeof (l as { name?: unknown })?.name === "string"
    )
    .map((l) => ({
      name: l.name,
      title: l.title ?? l.name,
      address: l.storefrontAddress?.addressLines?.join(", ") ?? null,
    }));
}
