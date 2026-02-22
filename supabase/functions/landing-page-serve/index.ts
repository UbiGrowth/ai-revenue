// Landing Page Serve
// Renders a saved landing page as HTML for public visitors
// GET /functions/v1/landing-page-serve?id={assetId}
// or: GET /functions/v1/landing-page-serve?tenant={tenantSlug}&slug={urlSlug}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FORM_SUBMIT_URL = `${SUPABASE_URL}/functions/v1/landing-form-submit`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(params: {
  headline: string;
  subheadline: string;
  supportingPoints: string[];
  sections: Array<{ type: string; title?: string; content?: string; items?: string[] }>;
  formFields: Array<{ name: string; label: string; type?: string; required?: boolean }>;
  ctaLabel: string;
  tenantSlug: string;
  urlSlug: string;
  formSubmitUrl: string;
}): string {
  const {
    headline, subheadline, supportingPoints, sections,
    formFields, ctaLabel, tenantSlug, urlSlug, formSubmitUrl,
  } = params;

  const supportingPointsHtml = (supportingPoints || []).map(point =>
    `<li class="sp-item">
      <span class="sp-check">✓</span>
      <span>${escapeHtml(point)}</span>
    </li>`
  ).join("");

  const sectionsHtml = (sections || []).map(section => {
    if (section.type === "features" && Array.isArray(section.items)) {
      const items = section.items.map((item: string) =>
        `<div class="feature-card">
          <div class="feature-icon">★</div>
          <p>${escapeHtml(item)}</p>
        </div>`
      ).join("");
      return `<section class="section features-section">
        <div class="container">
          ${section.title ? `<h2 class="section-title">${escapeHtml(section.title)}</h2>` : ""}
          <div class="features-grid">${items}</div>
        </div>
      </section>`;
    }
    if (section.type === "social_proof" && Array.isArray(section.items)) {
      const testimonials = section.items.map((item: string) =>
        `<div class="testimonial"><p>"${escapeHtml(item)}"</p></div>`
      ).join("");
      return `<section class="section testimonials-section">
        <div class="container">
          ${section.title ? `<h2 class="section-title">${escapeHtml(section.title)}</h2>` : ""}
          <div class="testimonials-grid">${testimonials}</div>
        </div>
      </section>`;
    }
    if (section.content) {
      return `<section class="section text-section">
        <div class="container">
          ${section.title ? `<h2 class="section-title">${escapeHtml(section.title)}</h2>` : ""}
          <p class="section-content">${escapeHtml(section.content)}</p>
        </div>
      </section>`;
    }
    return "";
  }).join("");

  const formFieldsHtml = (formFields || [
    { name: "full_name", label: "Full Name", type: "text", required: true },
    { name: "work_email", label: "Work Email", type: "email", required: true },
    { name: "company", label: "Company", type: "text", required: false },
    { name: "phone", label: "Phone", type: "tel", required: false },
  ]).map(field =>
    `<div class="form-group">
      <label for="${escapeHtml(field.name)}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
      <input
        type="${escapeHtml(field.type || "text")}"
        id="${escapeHtml(field.name)}"
        name="${escapeHtml(field.name)}"
        ${field.required ? "required" : ""}
        placeholder="${escapeHtml(field.label)}"
      />
    </div>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(headline)}</title>
  <meta name="description" content="${escapeHtml(subheadline)}" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; background: #fff; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .hero { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #fff; padding: 80px 0; text-align: center; }
    .hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700; line-height: 1.15; margin-bottom: 20px; }
    .hero p.sub { font-size: clamp(1rem, 2.5vw, 1.3rem); color: rgba(255,255,255,0.85); max-width: 700px; margin: 0 auto 32px; line-height: 1.6; }
    .sp-list { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 24px; max-width: 750px; margin: 0 auto; }
    .sp-item { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; color: rgba(255,255,255,0.9); }
    .sp-check { color: #4ade80; font-weight: bold; font-size: 1.1rem; }
    .section { padding: 60px 0; }
    .section:nth-child(even) { background: #f8f9fa; }
    .section-title { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 700; text-align: center; margin-bottom: 40px; color: #1a1a2e; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; }
    .feature-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .feature-icon { font-size: 2rem; margin-bottom: 12px; color: #6366f1; }
    .feature-card p { color: #374151; line-height: 1.6; }
    .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .testimonial { background: #fff; border-left: 4px solid #6366f1; padding: 20px 24px; border-radius: 8px; font-style: italic; color: #374151; line-height: 1.7; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .section-content { font-size: 1.05rem; line-height: 1.8; color: #374151; max-width: 750px; margin: 0 auto; text-align: center; }
    .form-section { padding: 60px 0; background: #f8f9fa; }
    .form-card { background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); padding: 40px; max-width: 540px; margin: 0 auto; }
    .form-card h2 { font-size: 1.75rem; font-weight: 700; text-align: center; margin-bottom: 8px; color: #1a1a2e; }
    .form-card .form-sub { text-align: center; color: #6b7280; margin-bottom: 28px; }
    .form-group { margin-bottom: 18px; }
    .form-group label { display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 12px 14px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s; outline: none; }
    .form-group input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .btn-submit { width: 100%; padding: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; border-radius: 8px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.1s; margin-top: 8px; }
    .btn-submit:hover { opacity: 0.92; }
    .btn-submit:active { transform: scale(0.99); }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .form-message { display: none; padding: 14px; border-radius: 8px; text-align: center; margin-top: 16px; font-weight: 500; }
    .form-message.success { background: #d1fae5; color: #065f46; display: block; }
    .form-message.error { background: #fee2e2; color: #991b1b; display: block; }
    .footer { background: #1a1a2e; color: rgba(255,255,255,0.5); text-align: center; padding: 24px; font-size: 0.85rem; }
    /* Honeypot */
    .hp-field { opacity: 0; position: absolute; top: 0; left: 0; height: 0; width: 0; z-index: -1; }
  </style>
</head>
<body>

<!-- Hero -->
<section class="hero">
  <div class="container">
    <h1>${escapeHtml(headline)}</h1>
    <p class="sub">${escapeHtml(subheadline)}</p>
    ${supportingPointsHtml ? `<ul class="sp-list">${supportingPointsHtml}</ul>` : ""}
  </div>
</section>

<!-- Dynamic Sections -->
${sectionsHtml}

<!-- Lead Capture Form -->
<section class="form-section">
  <div class="container">
    <div class="form-card">
      <h2>${escapeHtml(ctaLabel || "Get Started")}</h2>
      <p class="form-sub">Fill out the form below and we'll be in touch shortly.</p>
      <form id="lp-form" novalidate>
        <input type="text" name="_hp" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true" />
        ${formFieldsHtml}
        <button type="submit" class="btn-submit" id="lp-submit">${escapeHtml(ctaLabel || "Submit")}</button>
      </form>
      <div class="form-message" id="lp-msg"></div>
    </div>
  </div>
</section>

<footer class="footer">
  <p>Powered by AI Revenue OS &copy; ${new Date().getFullYear()}</p>
</footer>

<script>
  const FORM_SUBMIT_URL = ${JSON.stringify(formSubmitUrl)};
  const TENANT_SLUG = ${JSON.stringify(tenantSlug)};
  const PAGE_SLUG = ${JSON.stringify(urlSlug)};

  const form = document.getElementById('lp-form');
  const msg = document.getElementById('lp-msg');
  const btn = document.getElementById('lp-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-message';
    msg.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const formData = {};
    const inputs = form.querySelectorAll('input:not(.hp-field)');
    inputs.forEach(input => {
      if (input.name) formData[input.name] = input.value.trim();
    });

    const honeypot = form.querySelector('input[name="_hp"]');

    try {
      const res = await fetch(FORM_SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: TENANT_SLUG,
          slug: PAGE_SLUG,
          formData,
          _hp: honeypot ? honeypot.value : '',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        msg.className = 'form-message success';
        msg.textContent = 'Thank you! We\'ll be in touch soon.';
        form.reset();
      } else {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      msg.className = 'form-message error';
      msg.textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = ${JSON.stringify(ctaLabel || "Submit")};
    }
  });
</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const url = new URL(req.url);
    const assetId = url.searchParams.get("id");
    const tenantSlugParam = url.searchParams.get("tenant");
    const slugParam = url.searchParams.get("slug");

    let asset: any = null;
    let tenantSlug = "";

    if (assetId) {
      // Look up by asset ID
      const { data, error } = await supabase
        .from("cmo_content_assets")
        .select("id, tenant_id, title, key_message, cta, status, funnel_stage")
        .eq("id", assetId)
        .eq("content_type", "landing_page")
        .single();

      if (error || !data) {
        return new Response("Landing page not found", { status: 404, headers: corsHeaders });
      }
      asset = data;
    } else if (tenantSlugParam && slugParam) {
      // Look up by tenant slug + url slug
      const { data: tenantData } = await supabase
        .from("os_tenant_registry")
        .select("tenant_id")
        .eq("slug", tenantSlugParam)
        .single();

      if (!tenantData) {
        return new Response("Tenant not found", { status: 404, headers: corsHeaders });
      }

      tenantSlug = tenantSlugParam;

      // Find by tenant_id + urlSlug in cmo_content_variants metadata
      const { data: assets } = await supabase
        .from("cmo_content_assets")
        .select("id, tenant_id, title, key_message, cta, status, funnel_stage")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("content_type", "landing_page")
        .eq("status", "published");

      if (!assets || assets.length === 0) {
        return new Response("Landing page not found", { status: 404, headers: corsHeaders });
      }

      // Find the one with matching urlSlug in variant metadata
      for (const a of assets) {
        const { data: variants } = await supabase
          .from("cmo_content_variants")
          .select("metadata")
          .eq("asset_id", a.id)
          .eq("variant_name", "primary")
          .single();

        if (variants?.metadata?.urlSlug === slugParam) {
          asset = a;
          break;
        }
      }

      if (!asset) {
        return new Response("Landing page not found", { status: 404, headers: corsHeaders });
      }
    } else {
      return new Response(
        "Missing required parameter: ?id={assetId} or ?tenant={slug}&slug={pageSlug}",
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch content variant
    const { data: variant } = await supabase
      .from("cmo_content_variants")
      .select("body_content, cta_text, metadata")
      .eq("asset_id", asset.id)
      .eq("variant_name", "primary")
      .maybeSingle();

    let bodyContent: any = {};
    try {
      bodyContent = variant?.body_content
        ? JSON.parse(variant.body_content)
        : {};
    } catch {
      bodyContent = {};
    }

    // Resolve tenant slug if not already known
    if (!tenantSlug) {
      const { data: tenantData } = await supabase
        .from("os_tenant_registry")
        .select("slug")
        .eq("tenant_id", asset.tenant_id)
        .single();
      tenantSlug = tenantData?.slug || "unknown";
    }

    const pageSlug = bodyContent.urlSlug || variant?.metadata?.urlSlug || "page";

    const html = renderHtml({
      headline: asset.key_message || asset.title || "Welcome",
      subheadline: asset.cta || bodyContent.heroSubheadline || "",
      supportingPoints: bodyContent.heroSupportingPoints || [],
      sections: bodyContent.sections || [],
      formFields: bodyContent.formFields || [],
      ctaLabel: bodyContent.primaryCtaLabel || variant?.cta_text || "Get Started",
      tenantSlug,
      urlSlug: pageSlug,
      formSubmitUrl: FORM_SUBMIT_URL,
    });

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("[landing-page-serve] Error:", err);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});
