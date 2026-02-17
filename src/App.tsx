import { useEffect, useMemo, useState } from 'react';
import { applyUiPreferences, loadUiPreferences, saveUiPreferences } from './accessibility/uiPreferences';
import { MessageKey, renderMessage } from './i18n/messageCatalog';
import { defaultUiPreferences } from './theme/theme';

type LinkState = 'pending' | 'established' | 'lost';

type BroadcastEntry = { key: MessageKey; params?: Record<string, string> };

const linkKeyByState: Record<LinkState, MessageKey> = {
  pending: 'link.pending',
  established: 'link.established',
  lost: 'link.lost',
};

export function App() {
  const [prefs, setPrefs] = useState(defaultUiPreferences);
  const [bootAccepted, setBootAccepted] = useState(false);
  const [linkState, setLinkState] = useState<LinkState>('pending');
  const [broadcast, setBroadcast] = useState<BroadcastEntry[]>([
    { key: 'build.complete' },
    { key: 'attack.sent' },
    { key: 'resources.insufficient', params: { resource: 'METAL' } },
  ]);

  useEffect(() => {
    setPrefs(loadUiPreferences());
    const bootTimer = window.setTimeout(() => setBootAccepted(true), 1000);
    const linkTimer = window.setTimeout(() => setLinkState('established'), 1500);

    return () => {
      window.clearTimeout(bootTimer);
      window.clearTimeout(linkTimer);
    };
  }, []);

  useEffect(() => {
    saveUiPreferences(prefs);
    applyUiPreferences(document.body, prefs);
  }, [prefs]);

  const linkLabel = useMemo(() => renderMessage(linkKeyByState[linkState]), [linkState]);

  const simulateReconnectFlicker = () => {
    if (!prefs.crtEffectsEnabled) return;
    document.body.classList.add('crt-flicker');
    window.setTimeout(() => document.body.classList.remove('crt-flicker'), 200);
    setLinkState('lost');
    window.setTimeout(() => setLinkState('established'), 900);
    setBroadcast((existing) => [{ key: 'link.lost' }, { key: 'link.established' }, ...existing].slice(0, 7));
  };

  return (
    <main className="ui-shell crt">
      <section className="panel">
        <h1 className="title">Boot / Mission Brief</h1>
        <p className="status-good">{bootAccepted ? renderMessage('session.accepted') : renderMessage('boot.authenticating')}</p>
        <p>Universe speed: x2 · Ruleset: mvp_v1 · Aesthetic: retro_punk_future</p>
      </section>

      <section className="panel mt">
        <h2 className="title">Match Lobby</h2>
        <p>
          <button className="btn">Create Operation</button>
          <button className="btn ml">Join Operation (Code)</button>
        </p>
        <p>
          Opponent uplink:{' '}
          <span className={linkState === 'established' ? 'status-good' : linkState === 'pending' ? 'status-warn' : 'status-danger'}>
            {linkLabel}
          </span>
        </p>
      </section>

      <section className="panel mt">
        <h2 className="title">Command Console</h2>
        <div className="grid">
          <div className="panel">
            <h3 className="title">Telemetry</h3>
            <p>Scrap: 1200</p>
            <p>Circuitry: 455</p>
            <p>Fuel: 330</p>
          </div>
          <div className="panel">
            <h3 className="title">Fab Queue / Train Queue</h3>
            <p>Refinery Mk2 · 00:14</p>
            <p>Raiders x5 · 00:26</p>
          </div>
          <div className="panel">
            <h3 className="title">Broadcast Log</h3>
            {broadcast.map((event, idx) => (
              <p key={`${event.key}-${idx}`}>{renderMessage(event.key, event.params)}</p>
            ))}
          </div>
        </div>
        <div className="controls">
          <button className="btn">Issue Order</button>
          <button className="btn status-danger">Abort Campaign</button>
          <button className="btn" onClick={simulateReconnectFlicker}>
            Simulate Reconnect
          </button>
        </div>
      </section>

      <section className="panel mt">
        <h2 className="title">Accessibility</h2>
        <label>
          <input
            type="checkbox"
            checked={prefs.highContrast}
            onChange={(event) => setPrefs((current) => ({ ...current, highContrast: event.target.checked }))}
          />{' '}
          High contrast
        </label>
        <label className="ml">
          <input
            type="checkbox"
            checked={prefs.crtEffectsEnabled}
            onChange={(event) => setPrefs((current) => ({ ...current, crtEffectsEnabled: event.target.checked }))}
          />{' '}
          CRT effects
        </label>
      </section>
    </main>
  );
}
