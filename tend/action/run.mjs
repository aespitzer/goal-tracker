// Tend's notification sender. Runs hourly in a GitHub Action in the private data repo.
// Reads tend.json (written by the app), decides whether to send anything this hour,
// sends Web Push notifications, and records what it sent in tend-sent.json.
// It never prints item text, so the Action logs stay free of personal content.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as M from '../model.js';

const DATA = process.env.TEND_DATA || process.cwd();
const MODE = (process.env.TEND_MODE || 'run').trim() || 'run';
const NOW = process.env.TEND_NOW ? Number(process.env.TEND_NOW) : Date.now();
const KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();

const readJSON = f => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return null; } };
const tend = M.normalizeTend(readJSON('tend.json'));
const original = readJSON('tend-sent.json');
const sent = M.normalizeSent(original);
const s = { ...M.DEFAULT_SETTINGS, ...tend.settings };
let changed = false;

function setStatus(ok, message) {
  if (!sent.status || sent.status.ok !== ok || sent.status.message !== message) {
    sent.status = { ok, message, at: new Date(NOW).toISOString() };
    changed = true;
  }
  console.log(message);
}
function save() {
  sent.sends = sent.sends.filter(x => NOW - x.at < 400 * M.DAY);
  if (changed) fs.writeFileSync(path.join(DATA, 'tend-sent.json'), JSON.stringify(sent, null, 1) + '\n');
}

const endpointId = e => crypto.createHash('sha256').update(e).digest('hex').slice(0, 16);
const devices = M.liveDevices(tend).filter(d => d.endpoint && d.keys && d.vapid === s.vapidPublic && !sent.dead[endpointId(d.endpoint)]);

let webpush = null;
async function push(payload) {
  if (!webpush) {
    webpush = (await import('web-push')).default;
    webpush.setVapidDetails(M.APP_URL, s.vapidPublic, KEY);
  }
  let ok = 0;
  const errors = [];
  for (const d of devices) {
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'normal' });
      ok++;
    } catch (e) {
      const code = e.statusCode || 0;
      if (code === 404 || code === 410) { sent.dead[endpointId(d.endpoint)] = NOW; changed = true; errors.push(`a device's subscription expired (${code})`); }
      else errors.push(`push service returned ${code || e.message}${e.body ? ': ' + String(e.body).slice(0, 120) : ''}`);
    }
  }
  return { ok, errors };
}

function record(mode, items, extra = {}) {
  const nid = 'n' + NOW.toString(36) + crypto.randomBytes(3).toString('hex');
  const hour = Math.floor(M.zHour(NOW, s.tz));
  const send = { nid, at: NOW, hour, mode, items: items.map(i => i.id), kinds: [...new Set(items.map(i => i.kind))], ...extra };
  return send;
}
// Count consecutive unanswered sends per item, for the resend backoff.
function markSent(i) {
  const prev = sent.itemSends[i.id];
  const answered = prev && M.liveAnswers(tend).some(a => a.itemId === i.id && a.at >= prev.at);
  sent.itemSends[i.id] = { at: NOW, n: !prev || answered ? 1 : (prev.n || 1) + 1 };
}
function itemPayload(items, nid) {
  const url = `${M.APP_URL}?n=${nid}&i=${items.map(i => encodeURIComponent(i.id)).join(',')}`;
  if (items.length === 1) {
    const it = items[0];
    if (it.kind === 'habit') return { nid, title: it.text, body: 'When did you last do this?', url };
    return { nid, title: it.text, body: `Added ${M.itemAddedLabel(it, s.tz)}. When should it come back?`, url };
  }
  return { nid, title: `${items.length} quick check-ins`, body: items.map(i => i.text).join(' · '), url };
}
function digestPayload(nid) {
  const answers = M.liveAnswers(tend);
  const habits = M.activeItems(tend).filter(i => i.kind === 'habit')
    .map(i => ({ i, ...M.needScore(i, answers, NOW) })).filter(x => x.score !== null);
  if (!habits.length) return null;
  habits.sort((a, b) => b.score - a.score);
  const top = habits.filter(h => h.post.pShort > 0.5).slice(0, 2);
  const over = habits.filter(h => h.feel && h.feel.n && h.feel.less / h.feel.n > 0.5).slice(0, 1);
  const parts = [];
  if (top.length) parts.push('Needs the most help: ' + top.map(h => `${h.i.text} (${M.perWeekText(h.post.mean)}, aiming for ${M.targetOf(h.i.target).short})`).join('; '));
  else parts.push('Every habit looks on track.');
  if (over.length) parts.push(`Doing more than you'd like: ${over[0].i.text}.`);
  return { nid, title: 'Your week', body: parts.join(' '), url: `${M.APP_URL}?n=${nid}#insights` };
}

async function main() {
  if (MODE === 'test') {
    if (!s.vapidPublic || !KEY) return setStatus(false, 'Notification keys are missing. Finish step 1 in Settings → Notifications.');
    if (!devices.length) return setStatus(false, 'No device has notifications turned on yet. Do step 2 in Settings → Notifications on your phone.');
    const send = record('test', []);
    const r = await push({ nid: send.nid, title: 'Tend', body: 'Notifications are working.', url: M.APP_URL });
    send.delivered = r.ok;
    sent.sends.push(send); changed = true;
    return setStatus(r.ok > 0, r.ok ? `Test sent to ${r.ok} ${r.ok === 1 ? 'device' : 'devices'}.` : `Test failed: ${r.errors.join('; ')}`);
  }

  if (!M.activeItems(tend).length) return;
  const win = M.windowFor(NOW, s);
  if (!win) return; // quiet hours
  if (!s.vapidPublic || !KEY) return setStatus(false, 'Notification keys are missing. Finish step 1 in Settings → Notifications.');
  if (!devices.length) return setStatus(false, 'No device has notifications turned on. Do step 2 in Settings → Notifications on your phone.');

  const outs = M.outcomes(sent, tend, NOW);
  if (!sent.plan || sent.plan.date !== win.date) {
    sent.budget = M.adaptBudget(sent.budget, outs, NOW, s);
    sent.plan = M.planDay({ now: NOW, win, s, outs, budget: sent.budget });
    changed = true;
    console.log(`Planned ${sent.plan.slots.length} ${sent.plan.mode} slot(s) at hours ${sent.plan.slots.map(x => x.hour).join(', ')}${sent.plan.probe ? ' (one extra)' : ''}.`);
  }

  const results = [];
  // Reminders you asked to see within hours go out when due, outside the daily plan.
  const timed = M.activeItems(tend).filter(i => i.kind === 'reminder' && i.timed && (i.dueAt ?? Infinity) <= NOW && M.backoffOk(i.id, sent, tend, NOW));
  if (timed.length) {
    const send = record('timed', timed);
    const r = await push(itemPayload(timed, send.nid));
    send.delivered = r.ok;
    sent.sends.push(send); changed = true;
    for (const i of timed) markSent(i);
    results.push(r);
  }

  // Planned slots: send the earliest one that's come due. A slot more than 3 hours late
  // (the Action can be delayed) is dropped rather than sent at an hour it wasn't chosen for.
  const plan = sent.plan;
  for (const sl of plan.slots) if (sl.state === 'planned' && NOW - sl.at > 3 * M.HOUR) { sl.state = 'late'; changed = true; }
  const slot = plan.slots.find(sl => sl.state === 'planned' && sl.at <= NOW);
  if (slot) {
    const remaining = plan.slots.filter(sl => sl.state === 'planned').length;
    const firstToday = plan.slots.every(sl => sl === slot || sl.state === 'planned' || sl.state === 'late' || sl.state === 'empty');
    const recentDigest = sent.sends.some(x => x.mode === 'digest' && NOW - x.at < 6 * M.DAY);
    const localDow = M.zParts(NOW, s.tz).dow;
    let payload = null, send = null;
    if (localDow === s.digestDay && firstToday && !recentDigest) {
      send = record('digest', []);
      payload = digestPayload(send.nid);
    }
    if (!payload) {
      const prefer = M.kindForHour(outs, M.zParts(NOW, s.tz).h);
      const cands = M.dueItems(tend, NOW)
        .filter(i => !(i.kind === 'reminder' && i.timed))
        .filter(i => M.backoffOk(i.id, sent, tend, NOW))
        .map(i => ({ i, p: M.priority(i, tend, NOW) + (i.kind === prefer ? 10 : 0) }))
        .sort((a, b) => b.p - a.p).map(x => x.i);
      const k = plan.mode === 'group' ? Math.min(5, cands.length) : (cands.length > 2 * remaining ? 2 : 1);
      const items = cands.slice(0, k);
      if (!items.length) { slot.state = 'empty'; changed = true; console.log('Nothing due for this slot.'); }
      else {
        send = record(plan.mode, items, { probe: !!slot.probe });
        payload = itemPayload(items, send.nid);
        for (const i of items) markSent(i);
      }
    }
    if (payload && send) {
      const r = await push(payload);
      send.delivered = r.ok;
      sent.sends.push(send);
      slot.state = 'sent'; slot.nid = send.nid;
      changed = true;
      results.push(r);
      console.log(`Sent a ${send.mode} notification with ${send.items.length} item(s) to ${r.ok} device(s).`);
    }
  }

  for (const r of results) {
    if (!r.ok) return setStatus(false, `Couldn't deliver a notification: ${r.errors.join('; ')}`);
  }
  if (results.length) setStatus(true, 'Sending normally.');
}

main().then(save).catch(e => { setStatus(false, `The sender crashed: ${e.message}`); save(); process.exitCode = 1; });
