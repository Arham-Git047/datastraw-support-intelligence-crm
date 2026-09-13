export async function triggerN8n(event: unknown) {
  const url = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
  if (!url) return { skipped: true };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
    return { skipped: false, ok: res.ok };
  } catch {
    return { skipped: false, ok: false };
  }
}
