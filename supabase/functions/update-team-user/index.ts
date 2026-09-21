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
    const targetUserId = String(body.userId || "");
    const fullName = String(body.fullName || "").trim();
    const role = body.role === "MANAGER" ? "MANAGER" : "FIELD_STAFF";
    const password = String(body.password || "");
    const isActive = body.isActive !== false;

    if (!targetUserId) throw new Error("Kullanıcı seçilmedi.");
    if (password && password.length < 8) throw new Error("Yeni şifre en az 8 karakter olmalı.");

    const { data: myMemberships, error: myMemErr } = await userClient
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (myMemErr || !myMemberships?.length || myMemberships[0].role !== "MANAGER") {
      throw new Error("Bu işlem için MANAGER yetkisi gerekir.");
    }

    const orgId = myMemberships[0].organization_id;

    const { data: targetMembership, error: targetErr } = await adminClient
      .from("organization_members")
      .select("role,is_active")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId)
      .single();

    if (targetErr || !targetMembership) throw new Error("Kullanıcı bu ekipte bulunamadı.");

    // Last active manager cannot be demoted/deactivated.
    if (targetMembership.role === "MANAGER" && (role !== "MANAGER" || !isActive)) {
      const { count, error: countErr } = await adminClient
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "MANAGER")
        .eq("is_active", true);
      if (countErr) throw countErr;
      if ((count || 0) <= 1) throw new Error("Sistemde en az bir aktif yönetici kalmalı.");
    }

    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        full_name: fullName || null,
        role_label: role,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", targetUserId);
    if (profileErr) throw profileErr;

    const { error: membershipErr } = await adminClient
      .from("organization_members")
      .update({ role, is_active: isActive })
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId);
    if (membershipErr) throw membershipErr;

    if (password) {
      const { error: passwordErr } = await adminClient.auth.admin.updateUserById(
        targetUserId,
        { password }
      );
      if (passwordErr) throw passwordErr;
    }

    await adminClient.from("activity_log").insert({
      organization_id: orgId,
      actor_user_id: user.id,
      action: "UPDATE_USER",
      entity_type: "USER",
      entity_id: targetUserId,
      details: {
        full_name: fullName || null,
        role,
        is_active: isActive,
        password_reset: Boolean(password),
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
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
