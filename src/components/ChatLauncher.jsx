import React, { lazy, Suspense, useEffect, useState } from 'react';

const ChatPanel = lazy(() => import('./ChatPanel.jsx')); // the assistant code only loads when someone opens it

/** Floating "Ask Xchange" button. `lift` raises it above the comparison tray when that is open. */
export default function ChatLauncher({ app, lift }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Sit above the comparison tray when it is open, whatever height it has.
  const [trayH, setTrayH] = useState(0);
  useEffect(() => {
    const el = lift ? document.querySelector('section[aria-label="Direct comparison dock"]') : null;
    if (!el) { setTrayH(0); return undefined; }
    const ro = new ResizeObserver(() => setTrayH(el.offsetHeight));
    ro.observe(el);
    setTrayH(el.offsetHeight);
    return () => ro.disconnect();
  }, [lift]);
  const toggle = () => { setLoaded(true); setOpen((o) => !o); };
  return (
    <>
      {loaded && (
        <div hidden={!open}>
          <Suspense fallback={null}><ChatPanel app={app} open={open} offset={trayH} onClose={() => setOpen(false)} /></Suspense>
        </div>
      )}
      <button
        type="button" onClick={toggle} aria-expanded={open} aria-label={open ? 'Close assistant' : 'Open the Xchange assistant'}
        className="btn btn-primary fixed right-4 z-40 !rounded-full !px-3.5 !py-2.5 shadow-lg"
        style={{ bottom: trayH + 14 }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" /></svg>
        <span className="text-xs font-bold uppercase tracking-wider">{open ? 'Close' : 'Ask Xchange'}</span>
      </button>
    </>
  );
}
