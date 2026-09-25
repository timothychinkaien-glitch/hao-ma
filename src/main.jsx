import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const SAMPLE = { deviceId: 'Home safety monitor', timestamp: new Date().toISOString(), motionScore: 28, anomalyScore: 14 };
const DEFAULTS = { baseUrl: '', interval: 3000, motionThreshold: 70, anomalyThreshold: 65 };
const saved = JSON.parse(localStorage.getItem('csi-settings') || '{}');

function normalise(raw) {
  const packet = raw?.data || raw;
  const metrics = packet.metrics || {};
  return {
    deviceId: packet.deviceId || packet.device_id || 'Home safety monitor',
    timestamp: packet.timestamp || packet.time || new Date().toISOString(),
    motionScore: Number(packet.motionScore ?? packet.motion_score ?? metrics.motion ?? 0),
    anomalyScore: Number(packet.anomalyScore ?? packet.anomaly_score ?? metrics.anomaly ?? 0),
  };
}

function sendPhoneNotification(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const options = { body, icon: '/icon.svg', tag: 'safety-monitor-alert' };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => new Notification(title, options));
  } else new Notification(title, options);
}

function App() {
  const [settings, setSettings] = useState({ ...DEFAULTS, ...saved });
  const [packet, setPacket] = useState(SAMPLE);
  const [state, setState] = useState('demo');
  const [updated, setUpdated] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [simulatedAlert, setSimulatedAlert] = useState(false);
  const [pendingTest, setPendingTest] = useState(false);
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [showNotificationSetup, setShowNotificationSetup] = useState(typeof Notification !== 'undefined' && Notification.permission === 'default');
  const lastAlert = useRef(null);
  const testTimer = useRef(null);
  const realAlert = packet.motionScore >= settings.motionThreshold || packet.anomalyScore >= settings.anomalyThreshold;
  const alerting = simulatedAlert || realAlert;

  useEffect(() => { localStorage.setItem('csi-settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    let cancelled = false;
    const url = `${settings.baseUrl.replace(/\/$/, '')}/api/csi/latest`;
    async function poll() {
      if (!settings.baseUrl) { setState('demo'); return; }
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = normalise(await response.json());
        if (!cancelled) { setPacket(next); setUpdated(new Date()); setState('live'); }
      } catch { if (!cancelled) setState('offline'); }
    }
    poll(); const timer = setInterval(poll, Math.max(1000, settings.interval));
    return () => { cancelled = true; clearInterval(timer); };
  }, [settings.baseUrl, settings.interval]);
  useEffect(() => {
    if (simulatedAlert) return;
    if (!alerting) { lastAlert.current = null; return; }
    const type = packet.motionScore >= settings.motionThreshold ? 'motion' : 'anomaly';
    const key = `${packet.deviceId}:${type}`;
    if (state === 'live' && permission === 'granted' && lastAlert.current !== key) {
      sendPhoneNotification('Safety monitor alert', 'Your monitor noticed a change. Please check in.');
      lastAlert.current = key;
    }
  }, [alerting, simulatedAlert, packet.deviceId, packet.motionScore, settings.motionThreshold, state, permission]);
  useEffect(() => () => clearTimeout(testTimer.current), []);

  const change = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission); setShowNotificationSetup(false);
  };
  const runPracticeAlert = () => {
    if (pendingTest || simulatedAlert) {
      clearTimeout(testTimer.current); setPendingTest(false); setSimulatedAlert(false); return;
    }
    setPendingTest(true);
    testTimer.current = setTimeout(() => {
      setPendingTest(false); setSimulatedAlert(true);
      sendPhoneNotification('Practice safety alert', 'This is a test. Your home safety monitor is working.');
    }, 5000);
  };
  const seenAt = updated || (state === 'demo' ? new Date(packet.timestamp) : null);
  const status = pendingTest ? 'Testing your alert' : simulatedAlert ? 'Practice alert' : realAlert ? 'Please check in' : state === 'offline' ? 'Monitor needs attention' : 'Everything looks okay';
  const detail = pendingTest ? 'Your practice alert will arrive in 5 seconds.' : simulatedAlert ? 'This is only a test. You are safe.' : realAlert ? 'The monitor noticed a change in the room.' : state === 'offline' ? 'We cannot reach the home monitor right now.' : 'Your home safety monitor is working.';

  return <main className="app">
    {showNotificationSetup && <section className="notification-setup" role="dialog" aria-modal="true" aria-label="Turn on alerts"><div className="setup-icon" aria-hidden="true">♧</div><h1>Would you like safety alerts?</h1><p>We can send a message to this phone when the monitor notices a change.</p><button onClick={requestNotifications}>Turn on alerts</button><button className="not-now" onClick={() => setShowNotificationSetup(false)}>Not now</button></section>}
    <header className="topbar"><div className="brand-mark" aria-hidden="true">♥</div><p>Home safety monitor</p><button className="plain-button" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>Settings</button></header>
    {showSettings && <section className="settings" aria-label="Monitor settings"><h2>Connect your monitor</h2><p>Enter the address given to you by your helper.</p><label>Laptop monitor address<input value={settings.baseUrl} onChange={(event) => change('baseUrl', event.target.value)} placeholder="http://192.168.1.20:8080" inputMode="url" /></label><label>How often to check<input type="number" min="1000" step="1000" value={settings.interval} onChange={(event) => change('interval', Number(event.target.value))} /><span>milliseconds</span></label><details><summary>Alert settings</summary><label>Movement alert level<input type="number" min="0" max="100" value={settings.motionThreshold} onChange={(event) => change('motionThreshold', Number(event.target.value))} /></label><label>Change alert level<input type="number" min="0" max="100" value={settings.anomalyThreshold} onChange={(event) => change('anomalyThreshold', Number(event.target.value))} /></label></details><button className="done-button" onClick={() => setShowSettings(false)}>Done</button></section>}
    <section className={`status-card ${alerting ? 'alert' : state === 'offline' ? 'offline' : ''}`} aria-live="polite"><div className="status-symbol" aria-hidden="true">{alerting || state === 'offline' ? '!' : '✓'}</div><p className="status-label">{state === 'live' ? 'LIVE UPDATE' : state === 'demo' ? 'DEMO MODE' : 'CONNECTION CHECK'}</p><h1>{status}</h1><p className="status-detail">{detail}</p></section>
    <section className="monitor-card"><div className="monitor-icon" aria-hidden="true">⌂</div><div><p className="small-label">MONITORING</p><h2>{packet.deviceId}</h2><p className="last-check">{seenAt ? `Last checked at ${seenAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Trying to reconnect…'}</p></div><span className={`connection-dot ${state}`} aria-label={state === 'live' ? 'Connected' : state === 'offline' ? 'Offline' : 'Demo'} /></section>
    <section className="test-card"><div><h2>Want to see an alert?</h2><p>This sends a practice notification after 5 seconds.</p></div><button onClick={runPracticeAlert}>{pendingTest ? 'Cancel test' : simulatedAlert ? 'Back to normal' : 'Try an alert'}</button></section>
    <section className="help-card"><div><h2>Would you like alerts?</h2><p>We can show a message when the monitor notices a change.</p></div><button onClick={requestNotifications} disabled={permission === 'granted' || permission === 'unsupported'}>{permission === 'granted' ? 'Alerts are on' : 'Turn on alerts'}</button></section>
    <p className="reassurance">You do not need to do anything while the monitor says it is okay.</p>
  </main>;
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
createRoot(document.getElementById('root')).render(<App />);

