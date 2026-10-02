// Edge function for Tomorrow's Stars.
//
//   GET     list stars. Without the admin password, the title and message of
//           stars that have not lit up yet are blanked out, so a locked
//           surprise never reaches her phone before its day.
//   POST    create or update a star   (admin only)
//   DELETE  remove a star by ?id=     (admin only)
//
// Secret to set:  supabase secrets set STARS_ADMIN_PASSWORD=your-own-phrase
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-stars-admin",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TONES = ["gold", "blue", "rose", "violet"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const adminPassword = Deno.env.get("STARS_ADMIN_PASSWORD");
  const isAdmin = !!adminPassword && request.headers.get("x-stars-admin") === adminPassword;

  if (request.method === "GET") {
    const { data, error } = await db.from("future_stars").select("*").order("date", { ascending: true });
    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }
    // The earliest timezone is 14 hours ahead of UTC, so a star is only
    // withheld while its date is still in the future for every timezone.
    const cutoff = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10);
    const stars = (data ?? []).map((star) =>
      isAdmin || star.date <= cutoff ? star : { ...star, title: "", message: "" },
    );
    return json({ ok: true, admin: isAdmin, stars });
  }

  if (!isAdmin) {
    return json({ ok: false, error: "Not allowed." }, 403);
  }

  if (request.method === "POST") {
    const body = await request.json();
    const id = String(body.id ?? "").trim().replace(/[^a-z0-9-]/gi, "-").toLowerCase() || crypto.randomUUID();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "")) {
      return json({ ok: false, error: "Date must look like 2027-02-14." }, 400);
    }
    const row = {
      id,
      date: body.date,
      hint: String(body.hint ?? "").slice(0, 300),
      title: String(body.title ?? "").slice(0, 200),
      message: String(body.message ?? "").slice(0, 4000),
      tone: TONES.includes(body.tone) ? body.tone : "gold",
    };
    const { error } = await db.from("future_stars").upsert(row);
    return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true, id });
  }

  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return json({ ok: false, error: "Missing id." }, 400);
    }
    const { error } = await db.from("future_stars").delete().eq("id", id);
    return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
  }

  return json({ ok: false, error: "Unsupported." }, 405);
});
