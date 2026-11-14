(() => {
  'use strict';

  const config = window.VICE_CONFIG || {};
  const live = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const storagePrefix = 'vicetender-v3:';
  const sampleCurrencies = [
    { id: 'demo-gta-coin', name: 'GTA Coin', ticker: 'GTA', type: 'crypto',
      chain: 'UNITY RP-inspired economy', proposer: 'Community concept',
      pitch: 'A proposed in-server currency for GTA-inspired roleplay economies. Players could use GTA Coin for jobs, shopping, businesses, and trading.',
      votes_count: 286412, downvotes_count: 4738, created_at: '2026-11-14T12:00:00Z' }
  ];

  const $ = (selector) => document.querySelector(selector);
  const listEl = $('#currency-list');
  const modal = $('#submit-modal');
  const form = $('#submit-form');
  const toast = $('#toast');
  let currencies = [];
  let toastTimer;

  function storedJSON(key, fallback) {
    try {
      const result = JSON.parse(localStorage.getItem(storagePrefix + key));
      return result === null ? fallback : result;
    } catch (_) { return fallback; }
  }
  function storeJSON(key, value) {
    try { localStorage.setItem(storagePrefix + key, JSON.stringify(value)); } catch (_) { /* ignore disabled storage */ }
  }
  function getVoterKey() {
    let key = storedJSON('voter-id', null);
    if (!key || !/^[0-9a-f-]{36}$/i.test(key)) {
      key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12);
      storeJSON('voter-id', key);
    }
    return key;
  }
  const voterKey = getVoterKey();
  const votesGiven = new Set(storedJSON('votes-given', []));
  const downVotesGiven = new Set(storedJSON('downvotes-given', []));
  const numberFormat = new Intl.NumberFormat('en-US');
  const categories = { crypto: 'CRYPTO', memecoin: 'MEMECOIN', fiat: 'FIAT' };
  const palettes = [
    ['#fba773', '#5c2e42'], ['#9edfe2', '#254e63'], ['#ed8cac', '#663057'],
    ['#bca8ec', '#47306b'], ['#f3ce8c', '#61463b'], ['#d7b2ba', '#593c4e']
  ];

  function announce(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
  }
  function elt(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function logoFor(currency) {
    const div = elt('div', 'currency-logo');
    const symbol = (currency.ticker || currency.name || '?').replace(/[^A-Za-z0-9$]/g, '').slice(0, 3).toUpperCase() || '?';
    div.textContent = symbol;
    if (symbol.length > 2) div.classList.add('text-small');
    let hash = 0;
    for (const c of currency.name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
    const pair = palettes[Math.abs(hash) % palettes.length];
    div.style.background = `linear-gradient(145deg, ${pair[0]}, ${pair[1]})`;
    div.style.color = '#221522';
    return div;
  }
  function render() {
    const selected = [...currencies].sort((a, b) => Number(b.votes_count || 0) - Number(a.votes_count || 0) || a.name.localeCompare(b.name));
    listEl.replaceChildren();
    if (selected.length === 0) {
      const empty = elt('div', 'empty-state');
      empty.append(elt('strong', '', 'NO PROPOSALS YET.'), elt('span', '', 'Be the first to suggest a roleplay currency.'));
      listEl.append(empty);
    }
    for (let index = 0; index < selected.length; index++) {
      const currency = selected[index];

      if (currency.id === 'demo-gta-coin' && !live) {
        const featured = elt('article', 'currency-card featured-coin-card');
        featured.setAttribute('aria-label', 'GTA Coin fictional roleplay currency suggestion');
        const art = elt('div', 'featured-coin-art');
        const photo = elt('img', 'featured-coin-image');
        photo.src = 'gta-coin-art.jpg';
        photo.alt = 'Silver GTA Coin concept with GTA COIN embossed in the metal';
        photo.width = 300;
        photo.height = 300;
        art.append(photo);
        const details = elt('div', 'featured-coin-details');
        details.append(elt('div', 'featured-kicker', 'UNITY RP CONCEPT · FICTIONAL PROPOSAL'));
        details.append(elt('h3', 'featured-coin-title', 'GTA Coin'));
        const proposer = elt('div', 'featured-proposer', 'Proposed for ');
        proposer.append(elt('strong', '', 'UNITY RP-inspired community'), elt('span', '', ' · Independent concept'));
        details.append(proposer, elt('p', 'featured-description', currency.pitch));
        details.append(elt('p', 'featured-tally-note', 'Example reaction counts for this fictional roleplay concept. These are not real player votes.'));
        const buttons = elt('div', 'featured-votes');
        const up = elt('button', 'featured-vote-button upvote' + (votesGiven.has(currency.id) ? ' selected' : ''));
        up.type = 'button';
        up.setAttribute('aria-label', 'Upvote GTA Coin');
        up.append(elt('span', 'vote-icon', '↑'), elt('span', 'reaction-total', numberFormat.format(currency.votes_count || 0)), elt('small', '', 'UPVOTES'));
        up.disabled = votesGiven.has(currency.id) || downVotesGiven.has(currency.id);
        up.addEventListener('click', () => castVote(currency, up));
        const down = elt('button', 'featured-vote-button downvote' + (downVotesGiven.has(currency.id) ? ' selected' : ''));
        down.type = 'button';
        down.setAttribute('aria-label', 'Downvote GTA Coin');
        down.append(elt('span', 'vote-icon', '↓'), elt('span', 'reaction-total', numberFormat.format(currency.downvotes_count || 0)), elt('small', '', 'DOWNVOTES'));
        down.disabled = votesGiven.has(currency.id) || downVotesGiven.has(currency.id);
        down.addEventListener('click', () => castDownVote(currency));
        buttons.append(up, down);
        details.append(buttons);
        featured.append(art, details);
        listEl.append(featured);
        continue;
      }
      const card = elt('article', 'currency-card');
      const rank = elt('div', 'rank', String(index + 1).padStart(2, '0'));
      const icon = logoFor(currency);
      const title = elt('div', 'currency-title');
      title.append(elt('h3', '', currency.name));
      const symbol = elt('div', 'ticker-symbol', '$' + currency.ticker.toUpperCase());
      symbol.append(elt('span', 'category-pill', categories[currency.type] || 'CURRENCY'));
      title.append(symbol);
      const pitch = elt('p', 'currency-pitch', currency.pitch);
      const right = elt('div', 'vote-block');
      const tally = elt('div', 'vote-count', numberFormat.format(currency.votes_count || 0));
      tally.append(elt('small', '', 'VOTES'));
      const voted = votesGiven.has(currency.id);
      const voteButton = elt('button', 'vote-btn' + (voted ? ' voted' : ''), voted ? '✓ VOTED' : '↑ VOTE');
      voteButton.type = 'button';
      voteButton.disabled = voted;
      voteButton.setAttribute('aria-label', (voted ? 'Already voted for ' : 'Vote for ') + currency.name);
      voteButton.addEventListener('click', () => castVote(currency, voteButton));
      right.append(tally, voteButton);
      card.append(rank, icon, title, pitch, right);
      listEl.append(card);
    }
    $('#list-counter').textContent = `SHOWING ${selected.length} ${selected.length === 1 ? 'CURRENCY' : 'CURRENCIES'}`;
    $('#stat-currencies').textContent = numberFormat.format(currencies.length).padStart(2, '0');
    $('#stat-votes').textContent = numberFormat.format(currencies.reduce((sum, c) => sum + Number(c.votes_count || 0) + (!live ? Number(c.downvotes_count || 0) : 0), 0));
    $('#stat-votes-label').textContent = live ? 'PLAYER VOTES' : 'REACTIONS';
  }

  function apiHeaders(withJSON = false) {
    return { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, ...(withJSON ? {'Content-Type': 'application/json'} : {}) };
  }
  async function fetchLive() {
    const res = await fetch(`${baseUrl}/rest/v1/currency_nominations?select=id,name,ticker,type,chain,pitch,votes_count,created_at&status=eq.approved&order=votes_count.desc&limit=200`, { headers: apiHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load nominations (${res.status})`);
    currencies = await res.json();
    render();
  }
  function loadDemo() {
    const custom = storedJSON('demo-nominations', []);
    const countOverrides = storedJSON('demo-vote-counts', {});
    const downOverrides = storedJSON('demo-downvote-counts', {});
    currencies = [...sampleCurrencies, ...(Array.isArray(custom) ? custom : [])].map((c) => ({ ...c, votes_count: Number(countOverrides[c.id] ?? c.votes_count), downvotes_count: Number(downOverrides[c.id] ?? c.downvotes_count ?? 0) }));
    render();
  }
  function castDownVote(currency) {
    if (live || votesGiven.has(currency.id) || downVotesGiven.has(currency.id)) return;
    const counts = storedJSON('demo-downvote-counts', {});
    currency.downvotes_count = Number(currency.downvotes_count || 0) + 1;
    counts[currency.id] = currency.downvotes_count;
    storeJSON('demo-downvote-counts', counts);
    downVotesGiven.add(currency.id);
    storeJSON('downvotes-given', [...downVotesGiven]);
    render();
    announce('Downvote saved in this browser. Counts are illustrative.');
  }
  async function castVote(currency, button) {
    if (votesGiven.has(currency.id) || downVotesGiven.has(currency.id)) return;
    button.disabled = true;
    button.textContent = 'VOTING...';
    try {
      if (live) {
        const res = await fetch(`${baseUrl}/rest/v1/rpc/cast_vote`, {
          method: 'POST', headers: apiHeaders(true), body: JSON.stringify({ p_currency_id: currency.id, p_voter_key: voterKey })
        });
        if (!res.ok) throw new Error('Vote could not be recorded. Please try again.');
        const accepted = await res.json();
        if (!accepted) { votesGiven.add(currency.id); storeJSON('votes-given', [...votesGiven]); render(); announce('You already voted for this currency.'); return; }
        currency.votes_count++;
      } else {
        const counts = storedJSON('demo-vote-counts', {});
        currency.votes_count++;
        counts[currency.id] = currency.votes_count;
        storeJSON('demo-vote-counts', counts);
      }
      votesGiven.add(currency.id);
      storeJSON('votes-given', [...votesGiven]);
      render();
      announce(live ? `Vote recorded for ${currency.name}!` : `Vote for ${currency.name} saved in this browser.`);
    } catch (err) {
      button.disabled = false;
      button.textContent = '↑ VOTE';
      announce(err.message || 'Could not record your vote.');
    }
  }
  function openModal() {
    $('#form-error').textContent = '';
    modal.showModal();
    setTimeout(() => form.elements.name.focus(), 50);
  }
  document.querySelectorAll('.js-open-modal').forEach((node) => node.addEventListener('click', openModal));
  $('.close-modal').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.close(); });
  form.elements.pitch.addEventListener('input', () => { $('#pitch-count').textContent = form.elements.pitch.value.length; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#form-error').textContent = '';
    const name = form.elements.name.value.trim();
    const ticker = form.elements.ticker.value.trim().replace(/^\$+/, '').toUpperCase();
    const type = form.elements.type.value;
    const chain = form.elements.chain.value.trim();
    const contract_address = form.elements.contract_address.value.trim();
    const pitch = form.elements.pitch.value.trim();
    const email = form.elements.email.value.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('#form-error').textContent = 'Enter a valid email address for approval updates.';
      return;
    }
    if (!name || !ticker || pitch.length < 12 || !['crypto', 'memecoin', 'fiat'].includes(type)) {
      $('#form-error').textContent = 'Enter a name, ticker, and a pitch of at least 12 characters.';
      return;
    }
    if (!/^[A-Z0-9._-]{1,15}$/.test(ticker)) { $('#form-error').textContent = 'Use a ticker with letters, numbers, dots, dashes, or underscores.'; return; }
    if (currencies.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.ticker.toUpperCase() === ticker)) {
      $('#form-error').textContent = 'This currency is already on the ballot. Vote for it instead.'; return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const previous = submit.innerHTML;
    submit.textContent = 'SUBMITTING...';
    const payload = { name, ticker, type, chain: chain || null, contract_address: contract_address || null, pitch };
    try {
      if (live) {
        const res = await fetch(`${baseUrl}/rest/v1/rpc/submit_nomination`, {
          method: 'POST', headers: apiHeaders(true),
          body: JSON.stringify({
            p_name: name, p_ticker: ticker, p_type: type, p_chain: payload.chain,
            p_contract_address: payload.contract_address, p_pitch: pitch, p_email: email
          })
        });
        if (!res.ok) {
          const info = await res.json().catch(() => ({}));
          throw new Error(info.code === '23505' ? 'This currency was already submitted.' : 'Submission failed. Please check your details and try again.');
        }
        announce(config.approvalEmailsEnabled === true
          ? `${name} submitted! You'll receive an email if it is approved for voting.`
          : `${name} submitted for review. Email alerts are not enabled yet.`);
      } else {
        const custom = storedJSON('demo-nominations', []);
        const nomination = { ...payload, id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), votes_count: 0, created_at: new Date().toISOString() };
        custom.push(nomination);
        storeJSON('demo-nominations', custom);
        currencies.push(nomination);
        render();
        announce(`${name} saved locally. No email notification will be sent in preview mode.`);
      }
      modal.close();
      form.reset(); $('#pitch-count').textContent = '0';
      if (!live) $('#leaderboard').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      $('#form-error').textContent = err.message || 'Submission failed.';
    } finally {
      submit.disabled = false;
      submit.innerHTML = previous;
    }
  });

  if (live) {
    $('#form-footnote').textContent = config.approvalEmailsEnabled === true
      ? 'If moderators approve your currency for voting, we will email you once. Your address remains private.'
      : 'Your proposal enters a review queue. Approval notification emails are not enabled yet.';
    listEl.append(elt('div', 'empty-state', 'LOADING PROPOSALS...'));
    fetchLive().catch((err) => {
      listEl.replaceChildren();
      const error = elt('div', 'empty-state');
      error.append(elt('strong', '', 'CAN’T LOAD THE BALLOT.'), elt('span', '', err.message + ' Check your Supabase connection and SQL setup.'));
      listEl.append(error);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchLive().catch(() => {}); });
  } else {
    loadDemo();
  }
})();