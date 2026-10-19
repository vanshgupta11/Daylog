const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret';

/**
 * Signs a JWT and sets it as an httpOnly cookie.
 */
function issueToken(res, userId) {
  const token = jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  });
}

/**
 * Express middleware — verifies the JWT cookie and attaches req.userId.
 */
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

module.exports = { issueToken, requireAuth };
