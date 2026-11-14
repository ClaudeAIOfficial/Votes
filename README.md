# Vice Tender | Roleplay Currency Voting

A community roleplay voting interface for proposed server currencies. The featured GTA Coin and its large example counts are fictional demo content, not evidence of public voting.

## Current deployment
The page works as a browser-local demonstration until Supabase is connected. Submitting the form asks for an email address to notify the proposer if an admin approves the proposal for public voting. **In preview mode, the email is not sent anywhere or stored. No approval email will be sent.**

## Enable shared submissions and approval email notifications

1. Create a Supabase project and run `supabase.sql` in the SQL Editor. If you previously used this app's SQL, re-run the updated file to add `currency_submission_contacts` and the new secure submission/notification functions.
2. Update `config.js` with the Supabase project URL and its public anon/publishable key. **Never put the service-role key in `config.js`.** Live submissions now use `submit_nomination` and insert the email into a private table. Anonymous readers can only access selected public columns from approved nominations.
3. Create a Resend account, verify a sending domain, and generate a sending API key. Use a sender such as `Voting <notifications@your-verified-domain.com>`.
4. Configure these **server-side, production Vercel environment variables** for the `votes` project:
   - `SUPABASE_URL`: Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only secret role key
   - `RESEND_API_KEY`: Resend sending API key
   - `APPROVAL_FROM_EMAIL`: verified sender address
   - `APPROVAL_WEBHOOK_SECRET`: long random secret, 32+ characters
   - `PUBLIC_SITE_URL`: optional, e.g. `https://votes-sigma.vercel.app`
5. Redeploy after setting environment variables. In Supabase **Database Webhooks**, create an **UPDATE** webhook for `public.currency_nominations` to `https://votes-sigma.vercel.app/api/notify-approved`. Set an HTTP header `Authorization: Bearer <same-APPROVAL_WEBHOOK_SECRET>` and `Content-Type: application/json`.
6. Moderate submissions in Supabase's `currency_nominations` table. Change `status` from `pending` to `approved`. The webhook sends a one-time email when the proposal becomes available for voting. It uses Resend idempotency keys and a private approval claim, so duplicate webhook deliveries cannot send repeated emails in normal operation.
7. After confirming the webhook and mail sender work, set `approvalEmailsEnabled: true` in `config.js`. Until then keep it `false` so the interface does not claim notifications are operational.

The notification service is implemented in `api/notify-approved.js`. Only that server function uses the service-role key. The public site never receives service-role, webhook, or Resend secrets.

## Privacy and security
- The email address is used **only** to notify a proposer when their currency goes live for community voting. It is not displayed to visitors.
- `currency_submission_contacts` has RLS enabled, no anonymous read access, and is written only through the secure submission RPC.
- The voting UUID limits basic repeat votes, not automated spam. Add rate limits and challenge verification before public promotion.
- This is **not an official Rockstar Games site**. Rockstar Games and Take-Two Interactive do not operate or endorse it.
- The Rockstar logo image is supplied as site artwork, and the current interface includes a roleplay voting header.
