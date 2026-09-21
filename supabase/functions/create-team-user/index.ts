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

    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "MANAGER" ? "MANAGER" : "FIELD_STAFF";
    const fullName = String(body.fullName || "").trim();

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new Error("Kullanıcı adı 3-32 karakter olmalı; sadece harf, rakam, nokta, tire ve alt çizgi kullanılabilir.");
    }
    if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalı.");

    const { data: memberships, error: memErr } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (memErr || !memberships?.length) throw new Error("Aktif ekip üyeliği bulunamadı.");
    const orgId = memberships[0].organization_id;

    const { data: allowed, error: allowErr } = await userClient
      .rpc("can_manage_users", { target_org: orgId });

    if (allowErr || !allowed) throw new Error("Kullanıcı oluşturma yetkin yok.");

    const email = username + "@login.ilkesaha.local";

    const { data: existing } = await adminClient
      .from("profiles")
      .select("user_id")
      .ilike("username", username)
      .maybeSingle();

    if (existing) throw new Error("Bu kullanıcı adı zaten kullanılıyor.");

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });

    if (createErr || !created.user) throw createErr || new Error("Kullanıcı oluşturulamadı.");

    const newUserId = created.user.id;

    const { error: profileErr } = await adminClient.from("profiles").upsert({
      user_id: newUserId,
      username,
      full_name: fullName || null,
      email,
      role_label: role,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (profileErr) throw profileErr;

    const { error: membershipErr } = await adminClient.from("organization_members").insert({
      organization_id: orgId,
      user_id: newUserId,
      role,
      is_active: true,
    });
    if (membershipErr) throw membershipErr;

    await adminClient.from("activity_log").insert({
      organization_id: orgId,
      actor_user_id: user.id,
      action: "CREATE_USER",
      entity_type: "USER",
      entity_id: newUserId,
      details: { username, role, full_name: fullName || null },
    });

    return new Response(JSON.stringify({
      ok: true,
      userId: newUserId,
      username,
      role
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
