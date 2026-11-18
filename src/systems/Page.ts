// Page-level care for phones and tablets: the game area must not scroll, zoom,
// select text or pop up long-press menus, and portrait players get a friendly
// suggestion to turn the device (which they can wave away and play anyway).
import { touchCapable, touchMode } from './Touch';

/** Only the game's own element is locked down; the rest of the page keeps normal gestures. */
export function guardGameArea(el: HTMLElement) {
  const st = el.style as CSSStyleDeclaration & Record<string, string>;
  st.touchAction = 'none';
  st.userSelect = 'none';
  st.webkitUserSelect = 'none';
  st.webkitTouchCallout = 'none';
  st.webkitTapHighlightColor = 'transparent';
  st.overscrollBehavior = 'none';
  const stop = (e: Event) => e.preventDefault();
  el.addEventListener('gesturestart', stop); // iOS pinch zoom
  el.addEventListener('dblclick', stop);
  el.addEventListener('contextmenu', (e) => { if (touchMode()) e.preventDefault(); }); // long-press menu
  el.addEventListener('selectstart', stop);
}

let dismissed = false;

/** "Rotate your device" card for touch players in portrait. Never blocks: "Play anyway" closes it for the session. */
export function rotateHint(host: HTMLElement) {
  if (!touchCapable() && !touchMode()) return;
  const card = document.createElement('div');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Rotate your device');
  card.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:20', 'display:none', 'align-items:center', 'justify-content:center',
    'background:rgba(14,10,20,0.72)', 'backdrop-filter:blur(2px)', '-webkit-backdrop-filter:blur(2px)',
    'padding:max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
    'font-family:Nunito, system-ui, -apple-system, sans-serif', 'touch-action:manipulation',
  ].join(';');
  card.innerHTML = `
    <div style="max-width:300px;text-align:center;color:#f6e7c1;background:linear-gradient(#30263e,#1a1424);border:1.5px solid rgba(246,210,74,0.9);border-radius:16px;padding:22px 20px 18px;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
      <div aria-hidden="true" style="width:46px;height:74px;margin:0 auto 14px;border:3px solid #f6d24a;border-radius:10px;animation:mdTurn 2.4s ease-in-out infinite;position:relative">
        <div style="position:absolute;left:50%;bottom:5px;width:12px;height:3px;margin-left:-6px;border-radius:2px;background:#f6d24a"></div>
      </div>
      <div style="font-weight:900;font-size:20px;color:#ffe9a8;letter-spacing:0.5px">Turn your device sideways</div>
      <div style="font-size:14px;margin:6px 0 16px;line-height:1.35">Malu Dadayama plays best in landscape: more pond, bigger buttons.</div>
      <button type="button" style="font:800 15px Nunito, system-ui, sans-serif;color:#2b1b2e;background:linear-gradient(#fbe68a,#f6c93e 45%,#c98a1c);border:1.5px solid #3c2014;border-radius:10px;padding:10px 22px;min-height:44px">Play anyway</button>
    </div>
    <style>@keyframes mdTurn{0%,25%{transform:rotate(0)}55%,85%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
      @media (prefers-reduced-motion: reduce){[style*="mdTurn"]{animation:none!important;transform:rotate(-90deg)}}</style>`;
  host.appendChild(card);
  const portrait = window.matchMedia('(orientation: portrait)');
  const sync = () => { card.style.display = touchMode() && portrait.matches && !dismissed ? 'flex' : 'none'; };
  card.querySelector('button')!.addEventListener('click', () => { dismissed = true; sync(); });
  portrait.addEventListener?.('change', sync);
  window.addEventListener('resize', sync);
  sync();
}
