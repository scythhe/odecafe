// Stateless admin sessions: an HMAC-signed, expiring token in an httpOnly cookie.
import crypto from 'node:crypto';

const COOKIE = 'ode_admin';
const TTL_MS = 1000 * 60 * 60 * 12; // 12h

export function createAuth({ password, secret, secure }) {
  // Without SESSION_SECRET, derive a stable key from the password: every server/function
  // instance agrees on it, and changing the password signs everyone out.
  const key = secret || crypto.createHash('sha256').update(`ode-session:${password}`).digest('hex');
  const attempts = new Map(); // ip -> { count, until }

  const sign = (payload) => crypto.createHmac('sha256', key).update(payload).digest('base64url');

  function issue(res) {
    const exp = Date.now() + TTL_MS;
    const payload = `admin.${exp}`;
    res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
      httpOnly: true, sameSite: 'strict', secure, maxAge: TTL_MS, path: '/',
    });
  }

  function readCookie(req) {
    const raw = req.headers.cookie || '';
    const hit = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
    return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : '';
  }

  function isAuthed(req) {
    const token = readCookie(req);
    const i = token.lastIndexOf('.');
    if (i < 0) return false;
    const payload = token.slice(0, i);
    const sig = Buffer.from(token.slice(i + 1));
    const good = Buffer.from(sign(payload));
    if (sig.length !== good.length || !crypto.timingSafeEqual(sig, good)) return false;
    return Number(payload.split('.')[1]) > Date.now();
  }

  function checkPassword(input) {
    const a = crypto.createHash('sha256').update(String(input ?? '')).digest();
    const b = crypto.createHash('sha256').update(password).digest();
    return crypto.timingSafeEqual(a, b);
  }

  return {
    login(req, res) {
      const ip = req.ip;
      const rec = attempts.get(ip);
      if (rec && rec.until > Date.now()) {
        return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
      }
      if (!checkPassword(req.body?.password)) {
        const count = (rec?.count || 0) + 1;
        attempts.set(ip, { count, until: count >= 5 ? Date.now() + 60_000 : 0 });
        return res.status(401).json({ error: 'Wrong password' });
      }
      attempts.delete(ip);
      issue(res);
      res.json({ ok: true });
    },
    logout(_req, res) {
      res.clearCookie(COOKIE, { path: '/' });
      res.json({ ok: true });
    },
    require(req, res, next) {
      if (isAuthed(req)) return next();
      res.status(401).json({ error: 'Not signed in' });
    },
    isAuthed,
  };
}
