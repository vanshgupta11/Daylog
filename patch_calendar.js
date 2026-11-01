/**
 * wire_sidebar_profile.js
 *
 * Patches public/daylog.js so the sidebar's profile section:
 *  1. Receives real user data from parent via postMessage (daylog:auth)
 *  2. Shows name, email, initials avatar in the sidebar
 *  3. Has a Sign Out button that posts daylog:logout to parent window
 *  4. Falls back to "Guest / Local only" when running standalone
 */
const fs = require('fs');
const JS = 'public/daylog.js';
let js = fs.readFileSync(JS, 'utf8');

// ── 1. Add postMessage listener right after the IIFE opens ───────────────────
// We insert it just after "/* ---------- state ---------- */" block setup
const LISTEN_MARKER = `  var calDate = TODAY; // currently selected calendar day (day number)`;

const LISTENER_CODE = `

  // ── postMessage bridge: receive auth from React parent ──────────────────
  window.addEventListener('message', function(e) {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === 'daylog:auth') {
      profileUser = e.data.user || null;
      renderSide();
    }
  });
`;

if (js.includes(LISTEN_MARKER) && !js.includes('daylog:auth')) {
  js = js.replace(LISTEN_MARKER, LISTEN_MARKER + LISTENER_CODE);
  console.log('✅ postMessage listener added');
} else if (js.includes('daylog:auth')) {
  console.log('ℹ️  postMessage listener already present');
} else {
  console.warn('⚠️  marker not found for postMessage listener');
}

// ── 2. Update sidebar profile section to show real user + Sign out button ────
const OLD_PROFILE =
  `+ '<div class="profile-avatar" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="5.5" r="2.5"/><path d="M2.5 13.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg></div>'
      + '<div class="profile-info"><div class="pi-name">' + (profileUser || 'Guest') + '</div><div class="pi-sub">' + (profileUser ? 'Cloud account' : '<a href="/index.html" style="color:var(--blue);text-decoration:none">Sign in to sync</a>') + '</div></div>'`;

// Build replacement — with initials avatar + email + sign out
const NEW_PROFILE =
  `+ (function() {
        var u = profileUser;
        var initials = u && u.name ? u.name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2) : (u && u.email ? u.email.slice(0,2).toUpperCase() : '?');
        var avatar = u
          ? '<div class="pi-avatar" aria-hidden="true">' + initials + '</div>'
          : '<div class="pi-avatar pi-avatar-guest" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="5.5" r="2.5"/><path d="M2.5 13.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg></div>';
        var info = u
          ? '<div class="pi-name">' + esc(u.name || u.email || 'Daylog User') + '</div><div class="pi-sub">' + esc(u.email || '') + '</div>'
          : '<div class="pi-name">Guest</div><div class="pi-sub"><a href="/index.html" style="color:var(--blue);text-decoration:none">Sign in to sync</a></div>';
        var signout = u
          ? '<button class="pi-signout" data-act="signout" title="Sign out" aria-label="Sign out"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>'
          : '';
        return avatar + '<div class="profile-info">' + info + '</div>' + signout;
      }())`;

if (js.includes(OLD_PROFILE)) {
  js = js.replace(OLD_PROFILE, NEW_PROFILE);
  console.log('✅ Sidebar profile section updated with real user + sign out');
} else {
  console.warn('⚠️  Old profile pattern not found');
  // Show snippet for diagnosis
  const pIdx = js.indexOf('profile-info');
  if (pIdx > 0) console.log('profile-info context:', JSON.stringify(js.slice(pIdx - 80, pIdx + 200)));
}

// ── 3. Add 'signout' case to the click switch ────────────────────────────────
const SWITCH_END = `case 'fresh': S = blankState();`;

const SIGNOUT_CASE =
  `case 'signout': {
        if (window.confirm('Sign out of Daylog?')) {
          window.parent.postMessage({ type: 'daylog:logout' }, window.location.origin);
        }
        break;
      }
      ` + SWITCH_END;

if (js.includes(SWITCH_END) && !js.includes(`case 'signout'`)) {
  js = js.replace(SWITCH_END, SIGNOUT_CASE);
  console.log("✅ 'signout' case added to click handler");
} else if (js.includes(`case 'signout'`)) {
  console.log("ℹ️  signout case already present");
} else {
  console.warn('⚠️  switch end marker not found');
}

fs.writeFileSync(JS, js, 'utf8');
console.log('✅ daylog.js written');
