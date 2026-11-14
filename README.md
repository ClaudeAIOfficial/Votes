# Vice Tender

An unofficial GTA VI currency nomination and voting website. The interface includes a leaderboard, category filters, search, a nomination dialog, and one vote per currency per browser UUID.

## Preview immediately

Open `index.html` in Chrome or upload this folder to a static host. Preview mode works without any backend. Six example currencies appear with **fictional demo vote counts** clearly labeled as a preview. New nominations and votes are stored in **your current browser only**. They are not visible to other visitors.

## Make nominations and votes shared across visitors

1. Create a Supabase project at https://supabase.com.
2. Open its **SQL Editor**, paste and run `supabase.sql`.
3. In Supabase **Project Settings → API Keys** copy the project URL and the **anon / publishable** key. Do **not** copy the secret `service_role` key.
4. Edit `config.js` and insert those two values into `supabaseUrl` and `supabaseAnonKey`.
5. Publish the folder on Vercel, Netlify, Cloudflare Pages, GitHub Pages, or another static host.
6. Open Supabase **Table Editor → currency_nominations** to moderate submissions. Change `status` from `pending` to `approved`. Only approved entries appear in the public leaderboard.

The sample seed statements at the bottom of `supabase.sql` are optional. They create six approved nominations with zero votes. If you leave them commented out, your live leaderboard begins empty.

## Important production notes

- This is an independent fan project, **not affiliated with Rockstar Games or Take-Two Interactive**. The page says so clearly.
- The app never collects wallets, asks visitors to connect a wallet, or requires token purchases. Optional contract addresses are text only.
- Browser UUID voting limits casual repeat voting but is **not bot protection**. Before promoting the site publicly, add server-side rate limiting and a challenge such as Cloudflare Turnstile, plus submission moderation.
- Supabase row-level security allows anonymous visitors to read approved entries and create pending nominations, but only the protected `cast_vote` database function can increment vote counts.
- The static code includes no copied GTA logos, Rockstar artwork, game screenshots, or third-party assets.

## Customize

Change the brand and copy in `index.html`, the colors in `styles.css`, and the sample entries in `app.js`. If you later want user profiles or multiple votes, add proper sign-in and anti-abuse measures.
