import { cloudConfigured, currentSession, supabase } from './supabase';

/**
 * Send an in-game bug report straight to GitHub, through the `report-bug`
 * Edge Function (supabase/functions/report-bug). Signed-in players only: the
 * session is what keeps an open "create issue" endpoint from being a spam
 * cannon, and the GitHub token lives in the function, never in this bundle.
 * Everyone else gets the prefilled GitHub link instead.
 */
export interface OutgoingReport {
  title: string;
  what: string;
  details: string;
  screenshot: Blob | null;
}

export type SendResult =
  | { ok: true; number: number; url: string }
  | { ok: false; message: string };

/** Whether this player can send directly (cloud configured and signed in). */
export async function canSendReports(): Promise<boolean> {
  if (!cloudConfigured()) return false;
  try {
    return !!(await currentSession());
  } catch {
    return false;
  }
}

export async function sendBugReport(r: OutgoingReport): Promise<SendResult> {
  const form = new FormData();
  form.append('title', r.title);
  form.append('what', r.what);
  form.append('details', r.details);
  if (r.screenshot) form.append('screenshot', r.screenshot, 'screenshot.png');
  try {
    const { data, error } = await (await supabase()).functions.invoke<{ number: number; url: string }>('report-bug', { body: form });
    if (!error && data?.number) return { ok: true, number: data.number, url: data.url };
    // An HTTP error from the function carries our own message in its JSON body.
    const ctx = (error as { context?: unknown } | null)?.context;
    if (ctx instanceof Response) {
      const body = (await ctx.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (body?.error) return { ok: false, message: body.error };
      if (ctx.status === 404 || body?.code === 'NOT_FOUND') return { ok: false, message: 'The report server is not set up yet.' };
    }
    return { ok: false, message: 'Could not reach the report server.' };
  } catch {
    return { ok: false, message: 'Could not reach the report server.' };
  }
}
