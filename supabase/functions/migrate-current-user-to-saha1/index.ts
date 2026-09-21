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

    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();
    const username = "saha1";

    if (password.length < 8) throw new Error("saha1 şifresi en az 8 karakter olmalı.");

    const { data: memberships, error: memErr } = await adminClient
      .from("organization_members")
      .select("organization_id,role,is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (memErr || !memberships?.length) throw new Error("Mevcut ekip üyeliği bulunamadı.");
    const orgId = memberships[0].organization_id;

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("user_id,username")
      .ilike("username", username)
      .maybeSingle();

    let saha1UserId:string;

    if (existingProfile?.user_id) {
      saha1UserId = existingProfile.user_id;
    } else {
      const email = username + "@login.ilkesaha.local";
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName || "Mert" },
      });
      if (createErr || !created.user) throw createErr || new Error("saha1 hesabı oluşturulamadı.");
      saha1UserId = created.user.id;

      const { error: profileErr } = await adminClient.from("profiles").upsert({
        user_id: saha1UserId,
        username,
        full_name: fullName || "Mert",
        email,
        role_label: "FIELD_STAFF",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (profileErr) throw profileErr;

      const { error: membershipErr } = await adminClient.from("organization_members").insert({
        organization_id: orgId,
        user_id: saha1UserId,
        role: "FIELD_STAFF",
        is_active: true,
      });
      if (membershipErr) throw membershipErr;
    }

    // Safety snapshot of all legacy-owned rows before reassignment.
    const [dealers,visits,payments,meetings,settings] = await Promise.all([
      adminClient.from("dealers").select("*").eq("user_id", user.id),
      adminClient.from("visits").select("*").eq("user_id", user.id),
      adminClient.from("payment_promises").select("*").eq("user_id", user.id),
      adminClient.from("meeting_notes").select("*").eq("user_id", user.id),
      adminClient.from("user_settings").select("*").eq("user_id", user.id),
    ]);

    for (const r of [dealers,visits,payments,meetings,settings]) {
      if (r.error) throw r.error;
    }

    const snapshot = {
      source_user_id: user.id,
      target_user_id: saha1UserId,
      dealers: dealers.data || [],
      visits: visits.data || [],
      payment_promises: payments.data || [],
      meeting_notes: meetings.data || [],
      user_settings: settings.data || [],
    };

    const { error: backupErr } = await adminClient.from("data_backups").insert({
      user_id: user.id,
      organization_id: orgId,
      label: "pre-saha1-account-migration-" + new Date().toISOString(),
      snapshot,
    });
    if (backupErr) throw backupErr;

    // Reassign ownership while preserving organization and history.
    const updates = await Promise.all([
      adminClient.from("dealers")
        .update({ user_id: saha1UserId, created_by: saha1UserId, updated_by: saha1UserId })
        .eq("user_id", user.id),
      adminClient.from("visits")
        .update({ user_id: saha1UserId, actor_user_id: saha1UserId })
        .eq("user_id", user.id),
      adminClient.from("payment_promises")
        .update({ user_id: saha1UserId, actor_user_id: saha1UserId })
        .eq("user_id", user.id),
      adminClient.from("meeting_notes")
        .update({ user_id: saha1UserId, actor_user_id: saha1UserId })
        .eq("user_id", user.id),
    ]);

    const failed = updates.find(x => x.error);
    if (failed?.error) throw failed.error;

    // Settings has user_id as PK; migrate via upsert + delete old row.
    if (settings.data?.length) {
      const s = settings.data[0];
      const { error: upsertErr } = await adminClient.from("user_settings").upsert({
        ...s,
        user_id: saha1UserId,
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (upsertErr) throw upsertErr;

      const { error: deleteOldSettingsErr } = await adminClient
        .from("user_settings")
        .delete()
        .eq("user_id", user.id);
      if (deleteOldSettingsErr) throw deleteOldSettingsErr;
    }

    // Deactivate old legacy field membership, but never delete the auth user yet.
    const { error: oldMembershipErr } = await adminClient
      .from("organization_members")
      .update({ is_active: false })
      .eq("organization_id", orgId)
      .eq("user_id", user.id);
    if (oldMembershipErr) throw oldMembershipErr;

    await adminClient.from("activity_log").insert({
      organization_id: orgId,
      actor_user_id: user.id,
      action: "MIGRATE_USER_TO_SAHA1",
      entity_type: "USER",
      entity_id: saha1UserId,
      details: { from_user_id: user.id, username: "saha1" },
    });

    return new Response(JSON.stringify({
      ok: true,
      username: "saha1",
      newUserId: saha1UserId,
      message: "Veriler saha1 hesabına taşındı. Eski kullanıcı silinmedi; üyeliği pasif edildi."
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
