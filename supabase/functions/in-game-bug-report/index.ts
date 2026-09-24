// Looting Simulator — in-game bug report → GitHub issue.
//
// The game posts the player's words, the game-details table and a PNG
// screenshot here (multipart form). This verifies the player is signed in,
// rate-limits them, stores the screenshot in the public `bug-screenshots`
// bucket (GitHub has no API for issue attachments, so the image has to live
// somewhere with a URL), and opens the issue with it embedded.
//
// Secrets (set with `supabase secrets set`, never in the repo):
//   GITHUB_TOKEN  fine-grained token: Issues read/write on the one repo, nothing else
//   GITHUB_REPO   optional, defaults to snowu/looting-simulator
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
//
// Schema: supabase/bug_reports.sql.
import { createClient } from 'npm:@supabase/supabase-js@2';

const REPO = Deno.env.get('GITHUB_REPO') ?? 'snowu/looting-simulator';
const LABELS = ['from-game', 'needs-triage'];
const BUCKET = 'bug-screenshots';
const PER_HOUR = 5;
const PER_DAY = 20;
const MAX_PNG = 3 * 1024 * 1024;
const MAX_TITLE = 120;
const MAX_WHAT = 4000;
const MAX_DETAILS = 6000;

// The live site, and any localhost port for development.
const ALLOWED_ORIGIN = /^(https:\/\/snowu\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN.test(origin) ? origin : 'https://snowu.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

/** Player text goes into a public issue: an @mention would page a stranger. */
function defang(s: string): string {
  return s.replace(/@(?=[A-Za-z0-9])/g, '@​');
}

function field(form: FormData, name: string, max: number): string {
  const v = form.get(name);
  return typeof v === 'string' ? defang(v.trim()).slice(0, max) : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'POST only' });

  const token = Deno.env.get('GITHUB_TOKEN');
  if (!token) return reply(req, 503, { error: 'Bug reports are not set up on the server yet.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Signed-in players only: the session is the spam gate.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const user = auth.user;
  if (!user) return reply(req, 401, { error: 'Sign in (Settings → Cloud saves) to send reports from the game.' });

  const now = Date.now();
  const { data: recent, error: countErr } = await admin
    .from('bug_reports')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', new Date(now - 24 * 3600_000).toISOString());
  if (countErr) return reply(req, 500, { error: 'Could not check the report limit.' });
  const lastHour = (recent ?? []).filter((r) => Date.parse(r.created_at) > now - 3600_000).length;
  if (lastHour >= PER_HOUR || (recent ?? []).length >= PER_DAY) {
    return reply(req, 429, { error: 'That is a lot of reports in a short time. Try again later, or use the GitHub link.' });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return reply(req, 400, { error: 'Expected a form.' });
  }
  const what = field(form, 'what', MAX_WHAT);
  if (!what) return reply(req, 400, { error: 'Write what happened first.' });
  const title = field(form, 'title', MAX_TITLE) || 'Bug report';
  const details = field(form, 'details', MAX_DETAILS);

  // The screenshot is optional: a report without one still beats no report.
  let shotUrl: string | null = null;
  let shotPath: string | null = null;
  const shot = form.get('screenshot');
  if (shot instanceof File && shot.size > 0) {
    if (shot.size > MAX_PNG || shot.type !== 'image/png') return reply(req, 400, { error: 'The screenshot must be a PNG under 3 MB.' });
    shotPath = `${new Date(now).toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;
    const up = await admin.storage.from(BUCKET).upload(shotPath, shot, { contentType: 'image/png' });
    if (up.error) shotPath = null;
    else shotUrl = admin.storage.from(BUCKET).getPublicUrl(shotPath).data.publicUrl;
  }

  // Same sections as the in-game-report issue form, so both kinds read alike.
  const body = [
    '### What happened?', '', what, '',
    '### Screenshot', '', shotUrl ? `![Screenshot](${shotUrl})` : '_No screenshot._', '',
    '### Game details', '', details || '_None sent._', '',
    `<sub>Sent from the game by a signed-in player (${user.id.slice(0, 8)}).</sub>`,
  ].join('\n');

  const gh = (labels: string[]) =>
    fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'looting-simulator-report-bug',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    });
  let res = await gh(LABELS);
  // A token that may not set labels still gets the issue filed.
  if (res.status === 403 || res.status === 422) res = await gh([]);
  if (!res.ok) {
    if (shotPath) await admin.storage.from(BUCKET).remove([shotPath]);
    console.error('GitHub said', res.status, await res.text());
    return reply(req, 502, { error: 'GitHub refused the report. Use the GitHub link instead.' });
  }
  const issue = await res.json() as { number: number; html_url: string };

  await admin.from('bug_reports').insert({ user_id: user.id, issue_number: issue.number, screenshot_path: shotPath });
  return reply(req, 200, { number: issue.number, url: issue.html_url });
});
