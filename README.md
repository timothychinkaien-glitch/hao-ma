# Hao Ma?

## CSI Sentinel PWA

A phone-first React PWA for ESP32 Wi-Fi Channel State Information (CSI). The ESP32 sends CSI to a laptop bridge; this app polls that bridge over HTTP and presents one clear safety status, a simple connection check, and optional local notifications.

## Expected laptop API

Expose `GET /api/csi/latest` from the laptop bridge. Allow the PWA's origin through CORS. The response can be either the packet itself or `{ "data": packet }`.

```json
{
  "deviceId": "ESP32-CSI-01",
  "timestamp": "2026-09-25T04:10:00.000Z",
  "rssi": -53,
  "motionScore": 28,
  "presenceScore": 61,
  "anomalyScore": 14,
  "csi": [-42, -38, -31, -22, -16, -20, -27]
}
```

Snake-case fields (`motion_score`, `presence_score`, `anomaly_score`) and a nested `metrics` object are also accepted. Scores should be on a 0–100 scale; CSI is an array of amplitudes.

## Run it

Install Node.js **with npm** on the laptop, then:

```bash
npm install
npm run dev
```

Open the displayed local-network URL on the phone, tap the gear icon, and set the laptop bridge URL, for example `http://192.168.1.20:8080`. The setting is stored on the phone.

For a production installable PWA, serve `npm run build` behind HTTPS. Service workers and notification features generally require HTTPS (or localhost); plain HTTP on a LAN is suitable for development but is not reliably installable.

The first app launch asks whether to enable alerts. The **Try an alert** button creates a practice alert after five seconds. For alerts to arrive while the phone app is closed, add a Web Push server (with VAPID keys) to the laptop bridge; a browser page cannot keep a five-second timer alive after it is closed.

## Laptop bridge requirements

- Laptop and phone must be on the same network.
- Bind the bridge server to `0.0.0.0`, not only `localhost`.
- Configure CORS to allow the PWA origin.
- The app polls every three seconds by default; change this in settings.

