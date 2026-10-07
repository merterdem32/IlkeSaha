import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Oturum gerekli.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Oturum doğrulanamadı.");

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if ((profile?.username || "").toLowerCase() !== "saha1") {
      throw new Error("Bu derin kurtarma aracı yalnızca saha1 hesabı için kullanılabilir.");
    }

    const { data: membership, error: memErr } = await adminClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (memErr || !membership) throw new Error("Aktif ekip üyeliği bulunamadı.");
    const orgId = membership.organization_id;

    const { data: migrationRows, error: migErr } = await adminClient
      .from("activity_log")
      .select("actor_user_id,entity_id,details,created_at")
      .eq("organization_id", orgId)
      .eq("action", "MIGRATE_USER_TO_SAHA1")
      .eq("entity_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (migErr) throw migErr;

    const sourceIds = new Set<string>([user.id]);
    for (const row of migrationRows || []) {
      const from = row?.details?.from_user_id || row?.actor_user_id;
      if (from) sourceIds.add(String(from));
    }

    const sourceIdList = [...sourceIds];

    const [{ data: current, error: currentErr }, { data: backups, error: backupErr }] = await Promise.all([
      adminClient.from("meeting_notes").select("*").eq("user_id", user.id),
      adminClient.from("data_backups").select("id,user_id,label,snapshot,created_at")
        .eq("organization_id", orgId)
        .in("user_id", sourceIdList)
        .order("created_at", { ascending: false }),
    ]);
    if (currentErr) throw currentErr;
    if (backupErr) throw backupErr;

    let legacyRows:any[] = [];
    try {
      const { data, error } = await adminClient
        .from("legacy_backup_meeting_notes_20260921")
        .select("*")
        .in("user_id", sourceIdList);
      if (!error && Array.isArray(data)) legacyRows = data;
    } catch (_) {}

    const existingIds = new Set((current || []).map((x:any) => String(x.id)));
    const recovered = new Map<string, any>();

    const addRow = (n:any, fallbackCreated?:string) => {
      if (!n?.id) return;
      const id = String(n.id);
      if (existingIds.has(id) || recovered.has(id)) return;
      recovered.set(id, {
        id,
        user_id: user.id,
        organization_id: orgId,
        actor_user_id: user.id,
        title: n.title || "Toplantı Notu",
        note: n.note || "",
        meeting_date: n.meeting_date || n.meetingDate || null,
        status: n.status || "open",
        created_at: n.created_at || n.createdAt || fallbackCreated || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    };

    for (const b of backups || []) {
      let snap:any = b.snapshot;
      if (typeof snap === "string") {
        try { snap = JSON.parse(snap); } catch (_) { snap = null; }
      }
      const arrays = [
        snap?.meeting_notes,
        snap?.meetingNotes,
      ];
      for (const arr of arrays) {
        if (!Array.isArray(arr)) continue;
        for (const n of arr) addRow(n, b.created_at);
      }
    }

    for (const n of legacyRows) addRow(n);

    const rows = [...recovered.values()];
    if (rows.length) {
      const { error: upsertErr } = await adminClient
        .from("meeting_notes")
        .upsert(rows, { onConflict: "user_id,id" });
      if (upsertErr) throw upsertErr;
    }

    await adminClient.from("activity_log").insert({
      organization_id: orgId,
      actor_user_id: user.id,
      action: "MEETING_NOTE_DEEP_RECOVERY",
      entity_type: "MEETING_NOTE",
      entity_id: null,
      details: {
        recovered_count: rows.length,
        source_user_ids: sourceIdList,
        backup_count: (backups || []).length,
        legacy_count: legacyRows.length,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      recoveredCount: rows.length,
      currentCount: (current || []).length,
      backupCount: (backups || []).length,
      legacyCount: legacyRows.length,
      sourceUserCount: sourceIdList.length,
      titles: rows.slice(0,20).map((r:any) => r.title),
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
