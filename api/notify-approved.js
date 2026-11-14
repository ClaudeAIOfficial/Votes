// POST /api/notify-approved: private Supabase UPDATE webhook for approval emails.
// Requires Supabase service role, Resend, and a shared webhook secret.
// The private email never appears in a public API response or the vote leaderboard.
const crypto = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function securedEquals(a, b) {
  const lhs = Buffer.from(String(a || ''));
  const rhs = Buffer.from(String(b || ''));
  return lhs.length === rhs.length && crypto.timingSafeEqual(lhs, rhs);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const {
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
    APPROVAL_FROM_EMAIL, APPROVAL_WEBHOOK_SECRET
  } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY ||
      !APPROVAL_FROM_EMAIL || !APPROVAL_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Approval notifications not configured' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!securedEquals(token, APPROVAL_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const newRow = event && event.record;
  if (event?.type !== 'UPDATE' || event?.schema !== 'public' ||
      event?.table !== 'currency_nominations' || !newRow ||
      newRow.status !== 'approved' || event.old_record?.status === 'approved' ||
      !UUID.test(String(newRow.id || ''))) {
    return res.status(200).json({ ignored: true });
  }

  const id = newRow.id;
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  };
  async function rpc(action) {
    const response = await fetch(base + '/rest/v1/rpc/' + action, {
      method: 'POST', headers, body: JSON.stringify({ p_nomination_id: id })
    });
    if (!response.ok) throw new Error('Database notification action failed: ' + action);
    return response.json().catch(() => null);
  }

  let claimed = false;
  try {
    const recipients = await rpc('claim_approval_notification');
    if (!Array.isArray(recipients) || !recipients.length) {
      return res.status(200).json({ skipped: true });
    }
    claimed = true;
    const { recipient_email, currency_name, currency_ticker } = recipients[0];
    const safeName = String(currency_name).replace(/[\r\n]/g, ' ');
    const safeTicker = String(currency_ticker).replace(/[\r\n]/g, ' ');
    const siteUrl = process.env.PUBLIC_SITE_URL || 'https://votes-sigma.vercel.app';
    const message =
      'Your currency proposal, ' + safeName + ' ($' + safeTicker +
      '), has been approved and is now open for community voting.\n\n' +
      'View the ballot: ' + siteUrl.replace(/\/+$/, '') + '/#leaderboard\n\n' +
      'You received this one-time update because you supplied an email address when submitting the proposal. ' +
      'Vice Tender is an independent roleplay community project, not an official Rockstar Games service.';

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'vice-tender-approved-' + id
      },
      body: JSON.stringify({
        from: APPROVAL_FROM_EMAIL, to: [recipient_email],
        subject: safeName + ' is open for voting on Vice Tender', text: message
      })
    });
    if (!sent.ok) throw new Error('Email provider rejected the approval notification');
    await rpc('complete_approval_notification');
    return res.status(200).json({ sent: true });
  } catch (err) {
    if (claimed) {
      try { await rpc('release_approval_notification'); } catch (_) { /* retry lease */ }
    }
    console.error('Approval email delivery failed:', err.message);
    return res.status(502).json({ error: 'Approval notification could not be sent' });
  }
};
