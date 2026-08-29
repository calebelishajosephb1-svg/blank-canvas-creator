/**
 * netlify/functions/proxy.js — server-side relay for AI Tutor requests.
 *
 * Receives { url, headers, body, envKeyName } from the browser and forwards it to
 * the model API. A server-side key is injected only when the client did not supply
 * its own ("bring your own key" mode), so no key ever has to reach browser code.
 *
 * Note: on Lovable hosting the tutor already runs server-side via
 * src/lib/tutor.functions.ts and this function is not used. It exists so the same
 * app can be deployed to Netlify with a working /api/proxy endpoint.
 */
const ALLOWED_ENV_KEYS = new Set(["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "LOVABLE_API_KEY"]);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { url, headers = {}, body, envKeyName } = payload;
  if (!url) return { statusCode: 400, body: "Missing url" };

  const clientSuppliedKey = headers["x-api-key"] || headers["authorization"] || headers["Authorization"];
  if (envKeyName && !clientSuppliedKey) {
    if (!ALLOWED_ENV_KEYS.has(envKeyName)) {
      return { statusCode: 400, body: "Unsupported key name" };
    }
    const key = process.env[envKeyName];
    if (!key) return { statusCode: 500, body: `Server is not configured with ${envKeyName}` };
    if (envKeyName === "ANTHROPIC_API_KEY") headers["x-api-key"] = key;
    else if (envKeyName === "LOVABLE_API_KEY") headers["Lovable-API-Key"] = key;
    else headers["authorization"] = `Bearer ${key}`;
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
      body: text,
    };
  } catch (e) {
    return { statusCode: 502, body: `Upstream request failed: ${e.message}` };
  }
}
