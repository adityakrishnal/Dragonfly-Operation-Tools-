export interface StaffUser {
  id: string;
  name: string;
  designation: string | null;
  isAdmin: boolean;
}

export interface AuthState {
  sessionId: string;
  user: StaffUser;
}

const STORAGE_KEY = "dragonfly_auth";

export function loadStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

function storeAuth(auth: AuthState | null) {
  if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  else localStorage.removeItem(STORAGE_KEY);
}

export async function login(
  name: string,
  pin: string,
  station: string
): Promise<AuthState> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, pin, station }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed.");
  const auth: AuthState = { sessionId: data.sessionId, user: data.user };
  storeAuth(auth);
  return auth;
}

export async function logout(auth: AuthState | null) {
  if (auth) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: auth.sessionId }),
      });
    } catch {
      // best-effort — clear local state regardless
    }
  }
  storeAuth(null);
}

export async function fetchStaff(): Promise<StaffUser[]> {
  const res = await fetch("/api/auth/staff");
  const data = await res.json();
  return (data.staff || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    designation: s.designation,
    isAdmin: !!s.is_admin,
  }));
}

export async function addStaff(name: string, designation: string, pin: string) {
  const res = await fetch("/api/auth/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, designation, pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not add staff.");
}

export async function changePin(sessionId: string, currentPin: string, newPin: string) {
  const res = await fetch("/api/auth/change-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, currentPin, newPin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not change PIN.");
}

export async function resetStaffPin(sessionId: string, targetUserId: string, newPin: string) {
  const res = await fetch("/api/auth/reset-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, targetUserId, newPin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not reset PIN.");
}

export async function logActivity(
  auth: AuthState | null,
  station: string,
  app: string,
  action: string,
  details?: string
) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: auth?.sessionId,
        userId: auth?.user.id,
        userName: auth?.user.name ?? "Unknown",
        station,
        app,
        action,
        details,
      }),
    });
  } catch {
    // logging is best-effort — never block the UI on it
  }
}

export interface ActivityEntry {
  id: string;
  user_name: string;
  station: string | null;
  app: string;
  action: string;
  details: string | null;
  created_at: string;
}

export async function fetchActivity(
  sessionId: string,
  filters?: {
    user?: string;
    app?: string;
    limit?: number;
  }
): Promise<ActivityEntry[]> {
  const params = new URLSearchParams();
  params.set("sessionId", sessionId);
  if (filters?.user) params.set("user", filters.user);
  if (filters?.app) params.set("app", filters.app);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const res = await fetch("/api/activity?" + params.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load activity log.");
  return data.activity || [];
}
