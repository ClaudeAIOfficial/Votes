(() => {
  'use strict';

  const config = window.VICE_CONFIG || {};
  const live = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const storagePrefix = 'vicetender-v1:';
  const sampleCurrencies = [
    { id: 'demo-doge', name: 'Dogecoin', ticker: 'DOGE', type: 'memecoin', chain: 'Dogecoin', pitch: 'The original internet dog money. It already feels like it belongs in the streets of Leonida.', votes_count: 842, created_at: '2026-11-10T12:00:00Z' },
    { id: 'demo-btc', name: 'Bitcoin', ticker: 'BTC', type: 'crypto', chain: 'Bitcoin', pitch: 'Picture ATMs, shady beachside deals, and an entire economy running on Bitcoin.', votes_count: 716, created_at: '2026-11-09T12:00:00Z' },
    { id: 'demo-pepe', name: 'Pepe', ticker: 'PEPE', type: 'memecoin', chain: 'Ethereum', pitch: 'An internet legend that could make for the funniest in-game meme currency.', votes_count: 591, created_at: '2026-11-08T12:00:00Z' },
    { id: 'demo-sol', name: 'Solana', ticker: 'SOL', type: 'crypto', chain: 'Solana', pitch: 'Fast transactions, chaotic memecoins, and a very Leonida kind of energy.', votes_count: 437, created_at: '2026-11-07T12:00:00Z' },
    { id: 'demo-usd', name: 'US Dollar', ticker: 'USD', type: 'fiat', chain: '', pitch: 'Sometimes you just want to walk into a store with a stack of actual cash.', votes_count: 308, created_at: '2026-11-06T12:00:00Z' },
    { id: 'demo-eth', name: 'Ethereum', ticker: 'ETH', type: 'crypto', chain: 'Ethereum', pitch: 'Smart contracts and questionable side hustles: the perfect combination.', votes_count: 264, created_at: '2026-11-05T12:00:00Z' }
  ];

  const $ = (selector) => document.querySelector(selector);
  const listEl = $('#currency-list');
  const modal = $('#submit-modal');
  const form = $('#submit-form');
  const toast = $('#toast');
  let currencies = [];
  let filter = 'all';
  let sort = 'top';
  let search = '';
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
    const selected = currencies
      .filter((currency) => filter === 'all' || currency.type === filter)
      .filter((currency) => [currency.name, currency.ticker, currency.chain, currency.pitch].join(' ').toLowerCase().includes(search));
    selected.sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return Number(b.votes_count || 0) - Number(a.votes_count || 0) || a.name.localeCompare(b.name);
    });
    listEl.replaceChildren();
    if (selected.length === 0) {
      const empty = elt('div', 'empty-state');
      empty.append(elt('strong', '', 'NO CURRENCIES FOUND.'), elt('span', '', search ? 'Try another search or submit a new one.' : 'Nothing in this category yet. Be the first to nominate one.'));
      listEl.append(empty);
    }
    for (let index = 0; index < selected.length; index++) {
      const currency = selected[index];
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
    $('#stat-votes').textContent = numberFormat.format(currencies.reduce((sum, c) => sum + Number(c.votes_count || 0), 0));
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
    currencies = [...sampleCurrencies, ...(Array.isArray(custom) ? custom : [])].map((c) => ({ ...c, votes_count: Number(countOverrides[c.id] ?? c.votes_count) }));
    render();
  }
  async function castVote(currency, button) {
    if (votesGiven.has(currency.id)) return;
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
  document.querySelectorAll('.filter').forEach((btn) => btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    document.querySelectorAll('.filter').forEach((el) => el.classList.toggle('active', el === btn));
    render();
  }));
  $('#search').addEventListener('input', (event) => { search = event.target.value.trim().toLowerCase(); render(); });
  $('#sort').addEventListener('change', (event) => { sort = event.target.value; render(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#form-error').textContent = '';
    const name = form.elements.name.value.trim();
    const ticker = form.elements.ticker.value.trim().replace(/^\$+/, '').toUpperCase();
    const type = form.elements.type.value;
    const chain = form.elements.chain.value.trim();
    const contract_address = form.elements.contract_address.value.trim();
    const pitch = form.elements.pitch.value.trim();
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
        const res = await fetch(`${baseUrl}/rest/v1/currency_nominations`, {
          method: 'POST', headers: { ...apiHeaders(true), Prefer: 'return=minimal' }, body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const info = await res.json().catch(() => ({}));
          throw new Error(info.code === '23505' ? 'This currency was already submitted.' : 'Submission failed. Please check your details and try again.');
        }
        announce(`${name} submitted! It will appear after moderation.`);
      } else {
        const custom = storedJSON('demo-nominations', []);
        const nomination = { ...payload, id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), votes_count: 0, created_at: new Date().toISOString() };
        custom.push(nomination);
        storeJSON('demo-nominations', custom);
        currencies.push(nomination);
        filter = 'all'; sort = 'newest'; search = '';
        document.querySelectorAll('.filter').forEach((el) => el.classList.toggle('active', el.dataset.filter === 'all'));
        $('#sort').value = 'newest'; $('#search').value = '';
        render();
        announce(`${name} added to your local preview!`);
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
    $('#form-footnote').textContent = 'Your submission enters a moderation queue before appearing on the public leaderboard.';
    listEl.append(elt('div', 'empty-state', 'LOADING CURRENCIES...'));
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