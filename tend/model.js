// Tend's model. Shared by the app (browser) and the notification sender (Node, in a
// GitHub Action), so everything here is plain functions with no DOM or file access.

export const HOUR = 36e5;
export const DAY = 24 * HOUR;
export const APP_URL = 'https://aespitzer.github.io/goal-tracker/tend/';

/* ------------------------------------------------------------------ questions */

// "When did you last…?" Fixed, concrete day ranges for every habit. Asking about the last
// occurrence (one episode) is easier to recall accurately than estimating a frequency, and
// keeping the ranges identical across habits avoids the answer scale nudging the answer.
export const LAST_BUCKETS = [
  { id: 'today', label: 'Today', lo: 0, hi: 1 },
  { id: 'yesterday', label: 'Yesterday', lo: 1, hi: 2 },
  { id: 'd2', label: '2–3 days ago', lo: 2, hi: 4 },
  { id: 'd4', label: '4–7 days ago', lo: 4, hi: 8 },
  { id: 'w1', label: '1–2 weeks ago', lo: 8, hi: 15 },
  { id: 'w2', label: '2–4 weeks ago', lo: 15, hi: 29 },
  { id: 'older', label: 'Longer than that', lo: 29, hi: Infinity },
  { id: 'never', label: "Haven't started yet", lo: null, hi: Infinity },
];

// Asked once when a habit is added, and again only when answers drift from it.
export const TARGETS = [
  { id: 'daily', label: 'Every day', short: 'every day', perDay: 1 },
  { id: 'most', label: 'Most days', short: 'most days', perDay: 5.5 / 7 },
  { id: 'few', label: 'A few times a week', short: 'a few times a week', perDay: 3 / 7 },
  { id: 'weekly', label: 'Once a week', short: 'weekly', perDay: 1 / 7 },
  { id: 'biweekly', label: 'Every couple of weeks', short: 'every couple of weeks', perDay: 1 / 14 },
  { id: 'monthly', label: 'Once a month', short: 'monthly', perDay: 1 / 30 },
];

// How established the habit is when added. Sets the first check-in gap.
export const STAGES = [
  { id: 'new', label: "It's new", hint: 'Check in daily at first', interval: 1, ease: 1.6 },
  { id: 'partly', label: 'Getting there', hint: 'Check in every few days', interval: 3, ease: 2.0 },
  { id: 'automatic', label: 'Already automatic', hint: 'Check in now and then', interval: 10, ease: 2.5 },
];

// Asked when the answer is off target in either direction (and sometimes when on target):
// the question is whether the frequency feels right, not whether you hit a number.
export const FEELINGS = [
  { id: 'more', label: 'I want to do it more' },
  { id: 'right', label: 'This feels about right' },
  { id: 'less', label: "I'm doing it more than I want to" },
  { id: 'minor', label: 'It matters less than I thought' },
];

// One item from the Self-Report Behavioural Automaticity Index (Gardner et al., 2012),
// asked now and then once a habit is on track. "Yes" stretches the gaps faster.
export const AUTOMATICITY = [
  { id: 'yes', label: 'Yes, I do it without thinking' },
  { id: 'some', label: 'Sometimes' },
  { id: 'no', label: 'No, I have to remember' },
];

// "Remind me in…" for one-off reminders. Day-level choices land in a random day of the range.
export const REMIND_CHOICES = [
  { id: '3h', label: 'In a few hours', tick: '3h', timed: true, lo: 1 * HOUR, hi: 3 * HOUR },
  { id: '24h', label: 'Within a day', tick: '1d', timed: true, lo: 3 * HOUR, hi: 24 * HOUR },
  { id: 'days', label: 'Next few days', tick: 'days', loD: 2, hiD: 4 },
  { id: 'week', label: 'Next week', tick: '1w', loD: 6, hiD: 9 },
  { id: 'weeks', label: 'Next few weeks', tick: 'wks', loD: 14, hiD: 28 },
  { id: 'month', label: 'A month', tick: '1m', loD: 28, hiD: 40 },
  { id: 'months', label: 'Next few months', tick: 'mos', loD: 60, hiD: 120 },
  { id: 'year', label: 'Next year', tick: '1y', loD: 300, hiD: 430 },
  { id: '5y', label: 'Next five years', tick: '5y', loD: 730, hiD: 1826 },
];

export const DEFAULT_SETTINGS = {
  tz: 'America/Chicago',
  wakeStart: 10,      // first hour a notification may arrive (local)
  wakeEnd: 23,        // last moment one may arrive; may run past midnight (e.g. 25 = 1am)
  budgetStart: 3,     // notifications per day to start with
  budgetMax: 6,       // hard cap, however well extra pings go
  digestDay: 0,       // Sunday
  vapidPublic: '',
  updatedAt: 0,
};

export const targetOf = id => TARGETS.find(t => t.id === id) || TARGETS[0];
export const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
export const bucketOf = id => LAST_BUCKETS.find(b => b.id === id) || null;
export const remindOf = id => REMIND_CHOICES.find(c => c.id === id) || REMIND_CHOICES[2];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ data shape */

// tend.json is written by the app; tend-sent.json only by the sender.
export const COLS = ['items', 'answers', 'opens', 'devices'];
export function emptyTend() {
  return { version: 1, items: {}, answers: {}, opens: {}, devices: {}, settings: { ...DEFAULT_SETTINGS } };
}
export function normalizeTend(d) {
  const e = emptyTend();
  if (!d || typeof d !== 'object') return e;
  for (const c of COLS) if (d[c] && typeof d[c] === 'object') e[c] = d[c];
  if (d.settings && typeof d.settings === 'object') e.settings = { ...DEFAULT_SETTINGS, ...d.settings };
  return e;
}
export function emptySent() {
  return { version: 1, sends: [], plan: null, budget: null, itemSends: {}, dead: {}, status: null };
}
export function normalizeSent(d) {
  const e = emptySent();
  if (!d || typeof d !== 'object') return e;
  return { ...e, ...d, sends: Array.isArray(d.sends) ? d.sends : [], itemSends: d.itemSends || {}, dead: d.dead || {} };
}
const liveVals = o => Object.values(o || {}).filter(r => r && !r.deleted);
export const liveItems = t => liveVals(t.items);
export const activeItems = t => liveItems(t).filter(i => (i.status || 'active') === 'active');
export const liveAnswers = t => liveVals(t.answers);
export const liveDevices = t => liveVals(t.devices);

/* ------------------------------------------------------------------ time zones */

const fmtCache = new Map();
function fmt(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    }));
  }
  return fmtCache.get(tz);
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function zParts(ms, tz) {
  const p = {};
  for (const x of fmt(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, dow: WD[p.weekday] };
}
const pad = n => String(n).padStart(2, '0');
export function zDate(ms, tz) { const p = zParts(ms, tz); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; }
export function zHour(ms, tz) { const p = zParts(ms, tz); return p.h + p.min / 60; }
export function addDaysStr(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function tzOffset(ms, tz) {
  const p = zParts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(ms / 60000) * 60000;
}
// The instant that is `hour` hours into local date `dateStr` (hour may exceed 24).
export function zTime(dateStr, hour, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d) + hour * HOUR;
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return t;
}
// The waking window containing `now`, or null during quiet hours.
export function windowFor(now, s) {
  const tz = s.tz || DEFAULT_SETTINGS.tz;
  const today = zDate(now, tz);
  for (const off of [0, -1]) {
    const date = addDaysStr(today, off);
    const start = zTime(date, s.wakeStart, tz), end = zTime(date, s.wakeEnd, tz);
    if (now >= start && now < end) return { date, start, end };
  }
  return null;
}
export function nextWindowStart(now, s) {
  const tz = s.tz || DEFAULT_SETTINGS.tz;
  const today = zDate(now, tz);
  for (const off of [0, 1, 2]) {
    const t = zTime(addDaysStr(today, off), s.wakeStart, tz);
    if (t > now) return t;
  }
  return now + DAY;
}

/* ------------------------------------------------------------------ randomness */

export function hashRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000003) / 1000003;
}
function randn(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function sampleGamma(a, rand) {
  if (a < 1) return sampleGamma(a + 1, rand) * Math.pow(rand() || 1e-12, 1 / a);
  const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = randn(rand); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export function sampleBeta(a, b, rand = Math.random) {
  const x = sampleGamma(a, rand), y = sampleGamma(b, rand);
  return x / (x + y);
}

/* ------------------------------------------------------------------ habits */

export function bucketBounds(answer, item) {
  const b = bucketOf(answer.last);
  if (!b) return null;
  if (b.id === 'never') return { lo: Math.max(1, (answer.at - (item.createdAt || answer.at)) / DAY), hi: Infinity };
  return { lo: b.lo, hi: b.hi };
}

// Is one answer consistent with the target? A gap this long would be rare (<20%) if you were
// doing it at the target rate -> behind; a gap this short would be rare (<15%) -> ahead.
export function judge(bounds, perDay) {
  if (!bounds) return 'on';
  if (Math.exp(-perDay * bounds.lo) < 0.2) return 'behind';
  if (bounds.hi !== Infinity && 1 - Math.exp(-perDay * bounds.hi) < 0.15) return 'ahead';
  return 'on';
}

const GRID = Array.from({ length: 96 }, (_, i) => Math.exp(Math.log(1 / 400) + i * (Math.log(3) - Math.log(1 / 400)) / 95));

// Posterior over your actual rate (sessions per day) for one habit.
// Each "last time" answer is an interval-censored draw of the gap since the last session; if
// sessions arrive at rate λ, that gap is exponential, so P(answer) = e^{-λ·lo} - e^{-λ·hi}.
// Older answers count less (half weight after 30 days), and a weak prior sits on your target.
export function ratePosterior(item, answers, now) {
  const f = targetOf(item.target).perDay;
  const mu = Math.log(f), sd = 1.4;
  let logp = GRID.map(l => -((Math.log(l) - mu) ** 2) / (2 * sd * sd));
  let n = 0;
  for (const a of answers) {
    if (a.itemId !== item.id || !a.last || a.deleted) continue;
    const b = bucketBounds(a, item);
    if (!b) continue;
    const w = Math.pow(0.5, Math.max(0, now - a.at) / (30 * DAY));
    n++;
    for (let i = 0; i < GRID.length; i++) {
      const l = GRID[i];
      const p = Math.exp(-l * b.lo) - (b.hi === Infinity ? 0 : Math.exp(-l * b.hi));
      logp[i] += w * Math.log(Math.max(p, 1e-12));
    }
  }
  const mx = Math.max(...logp);
  let ps = logp.map(v => Math.exp(v - mx));
  const Z = ps.reduce((s, p) => s + p, 0);
  ps = ps.map(p => p / Z);
  const quant = q => { let c = 0; for (let i = 0; i < ps.length; i++) { c += ps[i]; if (c >= q) return GRID[i]; } return GRID[GRID.length - 1]; };
  let pShort = 0, pAhead = 0, mean = 0;
  for (let i = 0; i < ps.length; i++) {
    mean += ps[i] * GRID[i];
    if (GRID[i] < f * 0.85) pShort += ps[i];
    if (GRID[i] > f * 1.5) pAhead += ps[i];
  }
  return { n, perDay: f, mean, median: quant(0.5), lo: quant(0.1), hi: quant(0.9), pShort, pAhead };
}

// How do the frequency-feeling answers lean? Recent answers count more.
export function feelings(item, answers, now) {
  const c = { more: 0, right: 0, less: 0, minor: 0, n: 0 };
  for (const a of answers) {
    if (a.itemId !== item.id || !a.feel || a.deleted) continue;
    const w = Math.pow(0.5, Math.max(0, now - a.at) / (45 * DAY));
    c[a.feel] = (c[a.feel] || 0) + w;
    c.n += w;
  }
  return c;
}

// The "needs the most help" score: how likely you're short of the target, weighted by how
// much you've said you want to do it more. Null until there are a few answers.
export function needScore(item, answers, now) {
  const post = ratePosterior(item, answers, now);
  if (post.n < 2) return { score: null, post };
  const f = feelings(item, answers, now);
  const want = (f.more + 1) / (f.n + 2);
  const minor = f.n ? f.minor / f.n : 0;
  return { score: post.pShort * (0.5 + want) * (1 - 0.5 * minor), post, feel: f };
}

export function habitStatus(item, answers, now) {
  const { score, post, feel } = needScore(item, answers, now);
  if (post.n < 2) return { id: 'new', label: 'Learning', post, score };
  if (post.pShort > 0.6) return { id: 'behind', label: 'Behind', post, score, feel };
  if (post.pAhead > 0.6) return { id: 'ahead', label: 'Ahead', post, score, feel };
  return { id: 'on', label: 'On track', post, score, feel };
}

// Ask how the frequency feels whenever an answer is off target, and 1 time in 5 otherwise.
export function shouldAskFeeling(verdict, rand = Math.random) {
  return verdict !== 'on' || rand() < 0.2;
}
// Ask the automaticity item every third answer that isn't behind, once there are a couple.
export function shouldAskAuto(item, answers, verdict) {
  if (verdict === 'behind') return false;
  const k = answers.filter(a => a.itemId === item.id && a.last && !a.deleted).length;
  return k >= 2 && k % 3 === 0;
}

export function stepTarget(id, dir) {
  const i = TARGETS.findIndex(t => t.id === id);
  return TARGETS[clamp((i < 0 ? 0 : i) + dir, 0, TARGETS.length - 1)].id;
}

// Spaced-repetition style scheduling: steady answers stretch the gap to the next check-in
// (up to six weeks), slipping brings it back to a day or two.
export function updateHabit(item, { verdict, feel, auto }, now, rand = Math.random) {
  const st = stageOf(item.stage);
  const it = { ...item };
  let I = it.interval ?? st.interval;
  let ease = it.ease ?? st.ease;
  const notes = [];
  if (auto === 'yes') ease += 0.25;
  else if (auto === 'no') ease -= 0.2;
  if (verdict === 'behind') {
    // Behind and wanting more: check back soon, at about half the target gap (1–7 days).
    if (feel === 'more') { I = clamp(0.5 / targetOf(it.target).perDay, 1, 7); ease -= 0.2; }
    else if (feel === 'right' || feel === 'minor' || feel === 'less') {
      // Fine with doing it less: the target was too high, so lower it a step.
      const nt = stepTarget(it.target, +1);
      if (nt !== it.target) { it.target = nt; notes.push('target-down'); }
      I = Math.max(2, I);
    } else { I = Math.max(1, I * 0.5); ease -= 0.1; }
  } else if (verdict === 'ahead') {
    if (feel === 'right') {
      // Doing it more than planned and happy about it: raise the target to match.
      const nt = stepTarget(it.target, -1);
      if (nt !== it.target) { it.target = nt; notes.push('target-up'); }
    }
    if (feel === 'less') notes.push('more-than-wanted');
    I *= ease;
  } else {
    I = feel === 'more' ? Math.max(1, I * 0.8) : I * ease;
  }
  ease = clamp(ease, 1.3, 3.0);
  I = clamp(I, 1, 45);
  it.interval = I;
  it.ease = ease;
  it.nextDue = now + I * (0.9 + rand() * 0.2) * DAY;
  return { item: it, notes };
}

export function habitNextDue(item) {
  return item.nextDue ?? ((item.createdAt || 0) + stageOf(item.stage).interval * DAY);
}

/* ------------------------------------------------------------------ reminders */

export function clampToWindow(t, s) {
  return windowFor(t, s) ? t : nextWindowStart(t, s) + HOUR;
}
export function reminderDue(choiceId, now, s, rand = Math.random) {
  const c = remindOf(choiceId);
  const tz = s.tz || DEFAULT_SETTINGS.tz;
  if (c.timed) return { dueAt: clampToWindow(now + c.lo + rand() * (c.hi - c.lo), s), timed: true };
  const days = Math.round(c.loD + rand() * (c.hiD - c.loD));
  return { dueAt: zTime(addDaysStr(zDate(now, tz), days), s.wakeStart, tz), timed: false };
}

/* ------------------------------------------------------------------ what's due */

export function isDue(item, now) {
  if ((item.status || 'active') !== 'active') return false;
  if (item.kind === 'habit') return habitNextDue(item) <= now + 12 * HOUR;
  return (item.dueAt ?? 0) <= now;
}
export function dueItems(tend, now) {
  return activeItems(tend).filter(i => isDue(i, now));
}
export function priority(item, tend, now) {
  if (item.kind === 'habit') {
    const { score } = needScore(item, liveAnswers(tend), now);
    const I = item.interval ?? stageOf(item.stage).interval;
    return (score ?? 0.5) + Math.max(0, (now - habitNextDue(item)) / (I * DAY));
  }
  return 1 + Math.max(0, (now - (item.dueAt ?? now)) / DAY) / 7;
}

/* ------------------------------------------------------------------ engagement */

// When did you respond to each notification? Opening it, or answering any of its items.
export function responseTimes(tend) {
  const r = {};
  for (const o of liveVals(tend.opens)) if (o.id && o.at) r[o.id] = Math.min(r[o.id] ?? Infinity, o.at);
  for (const a of liveAnswers(tend)) if (a.nid && a.at) r[a.nid] = Math.min(r[a.nid] ?? Infinity, a.at);
  return r;
}
const COUNTED = new Set(['spread', 'group', 'timed', 'digest']);
export function outcomes(sent, tend, now) {
  const rt = responseTimes(tend);
  const answers = liveAnswers(tend);
  return (sent.sends || []).filter(s => COUNTED.has(s.mode) && s.delivered !== 0).map(s => {
    let respondedAt = rt[s.nid] ?? null;
    if (respondedAt !== null && respondedAt < s.at) respondedAt = null;
    const ids = s.items || [];
    const answeredItems = ids.filter(id => answers.some(a => a.itemId === id && a.at >= s.at && a.at < s.at + 2 * DAY)).length;
    // An item answered from the app counts as a response too, with that latency.
    if (respondedAt === null && answeredItems) {
      const first = Math.min(...answers.filter(a => ids.includes(a.itemId) && a.at >= s.at && a.at < s.at + 2 * DAY).map(a => a.at));
      respondedAt = first;
    }
    const age = now - s.at;
    return {
      send: s,
      respondedAt,
      latency: respondedAt === null ? null : respondedAt - s.at,
      quick: respondedAt !== null && respondedAt - s.at <= 2 * HOUR,
      settled: age > 2 * HOUR,          // too early to call a miss before this
      day: respondedAt !== null && respondedAt - s.at <= DAY,
      dayKnown: age > DAY,
      answeredItems,
      nItems: ids.length,
    };
  });
}

// What you said up front: reminders around midday planning time, habits later.
export function hourPrior(h, kind) {
  h = ((h % 24) + 24) % 24;
  const R = { 9: .25, 10: .35, 11: .6, 12: .65, 13: .65, 14: .6, 15: .45, 16: .45, 17: .45, 18: .45, 19: .45, 20: .4, 21: .4, 22: .35, 23: .3, 0: .25, 1: .2 };
  const H = { 9: .25, 10: .3, 11: .4, 12: .45, 13: .45, 14: .45, 15: .4, 16: .45, 17: .5, 18: .55, 19: .55, 20: .55, 21: .55, 22: .5, 23: .45, 0: .35, 1: .3 };
  const m = (kind === 'reminder' ? R : H)[h] ?? 0.1;
  return { a: 2 * m, b: 2 * (1 - m) };
}
// Per-hour chance of a quick response (within 2 hours), for one kind of notification.
// Neighbouring hours share some evidence, since 2pm and 3pm aren't independent.
export function hourModel(outs, kind) {
  const hits = Array(24).fill(0), miss = Array(24).fill(0), n = Array(24).fill(0);
  for (const o of outs) {
    if (!o.settled || o.send.hour == null) continue;
    if (kind && !(o.send.kinds || []).includes(kind)) continue;
    const h = o.send.hour;
    n[h]++;
    if (o.quick) hits[h]++; else miss[h]++;
  }
  const W = [1, 0.25, 0.08];
  return Array.from({ length: 24 }, (_, h) => {
    const pr = hourPrior(h, kind);
    let a = pr.a, b = pr.b;
    for (let d = -2; d <= 2; d++) {
      const k = (h + d + 24) % 24, w = W[Math.abs(d)];
      a += w * hits[k]; b += w * miss[k];
    }
    return { h, a, b, mean: a / (a + b), n: n[h] };
  });
}
// Grouped (one notification, several items) vs spread (one item at a time):
// which gets more items answered within a day?
export function modeModel(outs) {
  const m = { group: { a: 2, b: 2, sends: 0 }, spread: { a: 2, b: 2, sends: 0 } };
  for (const o of outs) {
    const k = o.send.mode;
    if (!m[k] || !o.dayKnown || !o.nItems) continue;
    m[k].sends++;
    m[k].a += o.answeredItems;
    m[k].b += o.nItems - o.answeredItems;
  }
  for (const k of Object.keys(m)) m[k].mean = m[k].a / (m[k].a + m[k].b);
  return m;
}

/* ------------------------------------------------------------------ daily budget */

// Starts at your setting. An extra "probe" ping goes out about one day in five; if you
// answer most probes and most pings overall, the budget goes up by one. If most pings go
// unanswered, it goes down. At most one change a week, never above the hard cap.
export function adaptBudget(budget, outs, now, s) {
  if (!budget) return { value: clamp(s.budgetStart, 1, s.budgetMax), startSeen: s.budgetStart, changedAt: now, history: [{ at: now, value: s.budgetStart, why: 'Starting point' }] };
  const b = { ...budget, history: [...(budget.history || [])] };
  if (b.startSeen !== s.budgetStart) {
    b.value = clamp(s.budgetStart, 1, s.budgetMax); b.startSeen = s.budgetStart; b.changedAt = now;
    b.history.push({ at: now, value: b.value, why: 'You changed the starting number' });
    return b;
  }
  b.value = clamp(b.value, 1, s.budgetMax);
  const since = now - (b.changedAt || 0);
  if (since < 7 * DAY) return b;
  const known = outs.filter(o => o.dayKnown && o.send.mode !== 'timed');
  const recent = known.filter(o => o.send.at > now - 14 * DAY);
  const dayRate = recent.length ? recent.filter(o => o.day).length / recent.length : null;
  const quickRate = recent.length ? recent.filter(o => o.quick).length / recent.length : null;
  const probes = known.filter(o => o.send.probe && o.send.at > now - 35 * DAY);
  const probeQuick = probes.length ? probes.filter(o => o.quick).length / probes.length : null;
  const pct = x => Math.round(x * 100) + '%';
  if (recent.length >= 6 && (dayRate < 0.45 || quickRate < 0.25) && b.value > 1) {
    b.value--; b.changedAt = now;
    b.history.push({ at: now, value: b.value, why: `Answered ${pct(dayRate)} of pings in two weeks (${pct(quickRate)} within 2 hours)` });
  } else if (since >= 14 * DAY && probes.length >= 4 && probeQuick >= 0.6 && dayRate >= 0.7 && b.value < s.budgetMax) {
    // Going up is slower than going down: two weeks apart, and only on quick answers.
    b.value++; b.changedAt = now;
    b.history.push({ at: now, value: b.value, why: `Answered ${pct(probeQuick)} of extra pings within 2 hours` });
  }
  return b;
}

/* ------------------------------------------------------------------ daily plan */

// Once a day, pick when to send. Thompson sampling: draw a plausible response rate for each
// hour from what's been learned, send at the hours that drew highest. Hours that haven't been
// tried keep wide uncertainty, so they still get tried now and then.
export function planDay({ now, win, s, outs, budget, rand = Math.random }) {
  const tz = s.tz;
  const byKind = { reminder: hourModel(outs, 'reminder'), habit: hourModel(outs, 'habit') };
  const modes = modeModel(outs);
  let n = budget.value;
  const probeDay = hashRand('probe:' + win.date) < 0.2 && n < s.budgetMax;
  const mode = n > 1 && sampleBeta(modes.group.a, modes.group.b, rand) > sampleBeta(modes.spread.a, modes.spread.b, rand) ? 'group' : 'spread';
  const probe = probeDay && mode === 'spread';
  if (probe) n++;
  const hours = [];
  for (let h = Math.ceil(s.wakeStart); h < s.wakeEnd; h++) {
    const at = zTime(win.date, h, tz);
    if (at >= now - 30 * 60e3 && at < win.end) hours.push({ h: h % 24, at });
  }
  const scored = hours.map(x => {
    const r = byKind.reminder[x.h], hb = byKind.habit[x.h];
    return { ...x, theta: 0.5 * (sampleBeta(r.a, r.b, rand) + sampleBeta(hb.a, hb.b, rand)) };
  }).sort((a, b) => b.theta - a.theta);
  const slots = [];
  if (mode === 'group') { if (scored[0]) slots.push(scored[0]); }
  else for (const x of scored) {
    if (slots.length >= n) break;
    // Better to send fewer than to send at an hour that drew a low chance of an answer.
    if (slots.length && x.theta < 0.2) continue;
    if (slots.every(y => Math.abs(y.at - x.at) >= 2 * HOUR)) slots.push(x);
  }
  if (probe && slots.length === n) slots[n - 1].probe = true;
  slots.sort((a, b) => a.at - b.at);
  return {
    date: win.date, mode, probe, budget: budget.value, madeAt: now,
    slots: slots.map(x => ({ at: x.at, hour: x.h, probe: !!x.probe, state: 'planned' })),
  };
}

// Which kind of item suits this hour better, going by what's been learned?
export function kindForHour(outs, h) {
  const r = hourModel(outs, 'reminder')[h], hb = hourModel(outs, 'habit')[h];
  return r.mean >= hb.mean ? 'reminder' : 'habit';
}

// Unanswered items wait longer before they're sent again: 1, 2, 4, then 7 days.
export function backoffOk(itemId, sent, tend, now) {
  const r = sent.itemSends?.[itemId];
  if (!r) return true;
  const answered = liveAnswers(tend).some(a => a.itemId === itemId && a.at >= r.at);
  if (answered) return true;
  const wait = [1, 2, 4, 7][Math.min(3, Math.max(0, (r.n || 1) - 1))];
  return now - r.at >= wait * DAY - 2 * HOUR;
}

/* ------------------------------------------------------------------ text */

export function fmtShortDate(ms, tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric', day: 'numeric', year: 'numeric' }).format(new Date(ms));
}
export function perWeekText(perDay) {
  const w = perDay * 7;
  if (w >= 6.5) return 'about every day';
  if (w >= 1.5) return `about ${Math.round(w)}× a week`;
  if (w >= 0.75) return 'about once a week';
  const days = Math.round(1 / perDay);
  if (days <= 21) return `about every ${days} days`;
  const mo = Math.round(days / 30);
  return mo <= 1 ? 'about once a month' : `about every ${mo} months`;
}
export function itemAddedLabel(item, tz) {
  return item.addedOn ? fmtShortDate(Date.parse(item.addedOn + 'T12:00:00Z'), 'UTC') : fmtShortDate(item.createdAt || Date.now(), tz);
}
