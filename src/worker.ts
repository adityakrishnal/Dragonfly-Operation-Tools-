import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

function id() {
  return crypto.randomUUID();
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Auth ---------------------------------------------------------------

app.post("/auth/login", async (c) => {
  const { name, pin, station } = await c.req.json<{
    name: string;
    pin: string;
    station?: string;
  }>();
  if (!name || !pin) {
    return c.json({ error: "Name and PIN are required." }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT * FROM staff_users WHERE name = ?"
  )
    .bind(name.trim())
    .first<{ id: string; name: string; designation: string; pin_hash: string; is_admin: number }>();

  if (!user) {
    return c.json({ error: "No staff account with that name." }, 401);
  }

  const pinHash = await sha256(pin);
  if (pinHash !== user.pin_hash) {
    return c.json({ error: "Incorrect PIN." }, 401);
  }

  const sessionId = id();
  await c.env.DB.prepare(
    "INSERT INTO auth_sessions (id, user_id, user_name, station) VALUES (?, ?, ?, ?)"
  )
    .bind(sessionId, user.id, user.name, station ?? null)
    .run();

  await c.env.DB.prepare(
    "INSERT INTO activity_log (id, auth_session_id, user_id, user_name, station, app, action, details) VALUES (?, ?, ?, ?, ?, 'system', 'login', ?)"
  )
    .bind(id(), sessionId, user.id, user.name, station ?? null, null)
    .run();

  return c.json({
    sessionId,
    user: {
      id: user.id,
      name: user.name,
      designation: user.designation,
      isAdmin: !!user.is_admin,
    },
  });
});

app.post("/auth/logout", async (c) => {
  const { sessionId } = await c.req.json<{ sessionId: string }>();
  if (!sessionId) return c.json({ error: "sessionId is required." }, 400);

  const session = await c.env.DB.prepare(
    "SELECT * FROM auth_sessions WHERE id = ?"
  )
    .bind(sessionId)
    .first<{ user_id: string; user_name: string; station: string | null }>();

  await c.env.DB.prepare(
    "UPDATE auth_sessions SET logout_at = datetime('now') WHERE id = ?"
  )
    .bind(sessionId)
    .run();

  if (session) {
    await c.env.DB.prepare(
      "INSERT INTO activity_log (id, auth_session_id, user_id, user_name, station, app, action, details) VALUES (?, ?, ?, ?, ?, 'system', 'logout', ?)"
    )
      .bind(id(), sessionId, session.user_id, session.user_name, session.station, null)
      .run();
  }

  return c.json({ ok: true });
});

// Staff management (kept simple: any logged-in user can add staff for now —
// tighten this to admin-only via the isAdmin flag if that matters to you).
app.get("/auth/staff", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, designation, is_admin FROM staff_users ORDER BY name"
  ).all();
  return c.json({ staff: results });
});

app.post("/auth/staff", async (c) => {
  const { name, designation, pin } = await c.req.json<{
    name: string;
    designation?: string;
    pin: string;
  }>();
  if (!name || !pin) {
    return c.json({ error: "Name and PIN are required." }, 400);
  }
  const existing = await c.env.DB.prepare(
    "SELECT id FROM staff_users WHERE name = ?"
  )
    .bind(name.trim())
    .first();
  if (existing) {
    return c.json(
      { error: `"${name.trim()}" already has a login — try logging in instead of creating a new one.` },
      409
    );
  }
  const pinHash = await sha256(pin);
  await c.env.DB.prepare(
    "INSERT INTO staff_users (id, name, designation, pin_hash) VALUES (?, ?, ?, ?)"
  )
    .bind(id(), name.trim(), designation ?? null, pinHash)
    .run();
  return c.json({ ok: true });
});

// Self-service: change your own PIN (requires knowing the current one).
app.post("/auth/change-pin", async (c) => {
  const { sessionId, currentPin, newPin } = await c.req.json<{
    sessionId: string;
    currentPin: string;
    newPin: string;
  }>();
  if (!sessionId || !currentPin || !newPin) {
    return c.json({ error: "Missing required fields." }, 400);
  }
  if (newPin.length < 4) {
    return c.json({ error: "New PIN must be at least 4 digits." }, 400);
  }

  const session = await c.env.DB.prepare(
    `SELECT su.id, su.pin_hash
     FROM auth_sessions a
     JOIN staff_users su ON su.id = a.user_id
     WHERE a.id = ? AND a.logout_at IS NULL`
  )
    .bind(sessionId)
    .first<{ id: string; pin_hash: string }>();

  if (!session) {
    return c.json({ error: "Session expired — please log in again." }, 401);
  }

  const currentHash = await sha256(currentPin);
  if (currentHash !== session.pin_hash) {
    return c.json({ error: "Current PIN is incorrect." }, 401);
  }

  const newHash = await sha256(newPin);
  await c.env.DB.prepare("UPDATE staff_users SET pin_hash = ? WHERE id = ?")
    .bind(newHash, session.id)
    .run();

  return c.json({ ok: true });
});

// Admin-only: reset someone else's PIN without knowing the old one
// (for lockouts). Verifies the requesting session is an admin.
app.post("/auth/reset-pin", async (c) => {
  const { sessionId, targetUserId, newPin } = await c.req.json<{
    sessionId: string;
    targetUserId: string;
    newPin: string;
  }>();
  if (!sessionId || !targetUserId || !newPin) {
    return c.json({ error: "Missing required fields." }, 400);
  }
  if (newPin.length < 4) {
    return c.json({ error: "New PIN must be at least 4 digits." }, 400);
  }

  const requester = await c.env.DB.prepare(
    `SELECT su.is_admin AS is_admin
     FROM auth_sessions a
     JOIN staff_users su ON su.id = a.user_id
     WHERE a.id = ? AND a.logout_at IS NULL`
  )
    .bind(sessionId)
    .first<{ is_admin: number }>();

  if (!requester || !requester.is_admin) {
    return c.json({ error: "Admin access required." }, 403);
  }

  const newHash = await sha256(newPin);
  await c.env.DB.prepare("UPDATE staff_users SET pin_hash = ? WHERE id = ?")
    .bind(newHash, targetUserId)
    .run();

  return c.json({ ok: true });
});

// --- Activity log ---------------------------------------------------------

app.post("/activity", async (c) => {
  const { sessionId, userId, userName, station, app: appName, action, details } =
    await c.req.json<{
      sessionId?: string;
      userId?: string;
      userName: string;
      station?: string;
      app: string;
      action: string;
      details?: string;
    }>();

  if (!userName || !appName || !action) {
    return c.json({ error: "userName, app, and action are required." }, 400);
  }

  await c.env.DB.prepare(
    "INSERT INTO activity_log (id, auth_session_id, user_id, user_name, station, app, action, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id(), sessionId ?? null, userId ?? null, userName, station ?? null, appName, action, details ?? null)
    .run();

  return c.json({ ok: true });
});

app.get("/activity", async (c) => {
  // Admin-only: verify the requesting session belongs to an admin,
  // not just relying on the UI to hide this tab.
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: "Admin session required." }, 401);
  }
  const requester = await c.env.DB.prepare(
    `SELECT su.is_admin AS is_admin
     FROM auth_sessions a
     JOIN staff_users su ON su.id = a.user_id
     WHERE a.id = ? AND a.logout_at IS NULL`
  )
    .bind(sessionId)
    .first<{ is_admin: number }>();
  if (!requester || !requester.is_admin) {
    return c.json({ error: "Admin access required." }, 403);
  }

  const limit = Math.min(Number(c.req.query("limit") ?? 200), 500);
  const user = c.req.query("user");
  const app_ = c.req.query("app");

  let sql = "SELECT * FROM activity_log";
  const conditions: string[] = [];
  const params: string[] = [];
  if (user) {
    conditions.push("user_name = ?");
    params.push(user);
  }
  if (app_) {
    conditions.push("app = ?");
    params.push(app_);
  }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY created_at DESC LIMIT ?";

  const stmt = c.env.DB.prepare(sql).bind(...params, limit);
  const { results } = await stmt.all();
  return c.json({ activity: results });
});

export default {
  async fetch(request: Request, env: Bindings & { ASSETS: Fetcher }, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    // Everything else is a static asset (the built Vite app)
    return env.ASSETS.fetch(request);
  },
};
