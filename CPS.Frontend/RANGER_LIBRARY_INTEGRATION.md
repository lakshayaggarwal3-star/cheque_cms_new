# Ranger Library Integration Notes

This project integrates the Silver Bullet Ranger browser library from:

- `public/ranger/DefaultWebSocketUrl.js`
- `public/ranger/Ranger.js`
- `public/ranger/sbullet.css`

Scripts are loaded in `public/index.html` so React can access `window.MakeRanger`.

## Connection and Transport Lifecycle

Primary methods exposed by Ranger and wired in the app:

- `StartUp()` - connect to Ranger Remote websocket service.
- `EnableOptions()` - apply current options and move scanner to ready-to-feed.
- `StartFeeding(feedType, feedCount)` - begin feeding.
- `StopFeeding()` - stop feeding.
- `PrepareToChangeOptions()` - move back to option-change state.
- `ShutDown()` - close scanner session.

Main transport states returned by `GetTransportStateString()`:

- `TransportShutDown`
- `TransportStartingUp`
- `TransportChangeOptions`
- `TransportEnablingOptions`
- `TransportReadyToFeed`
- `TransportFeeding`
- `TransportExceptionInProgress`
- `TransportShuttingDown`

## Capture and Data APIs

Used by current React scanner flow:

- `GetImageBase64(side, colorType)`
  - `side`: `0` front, `1` rear
  - `colorType`: grayscale uses `1`
- `GetMicrText(line)` - MICR line text
- `GetVersion()` - scanner version
- `GetInfo("Version", "RangerServer")` - ranger remote server info

### How capture is persisted in CPS

For Ranger mode, React:

1. Requests base64 images from Ranger.
2. Converts base64 to `File`.
3. Uploads through existing API endpoint:
  - `POST /api/scan/{batchId}/upload-mobile`
4. Backend stores files and creates `ScanItem`.

This keeps RR/session logic unchanged while enabling client-side Ranger capture.

## Configurable Generic Options

From sample and available API, common option controls:

- `OptionalDevices / NeedImaging`
- `OptionalDevices / NeedFrontImage1` (bitonal front)
- `OptionalDevices / NeedRearImage1` (bitonal rear)
- `OptionalDevices / NeedFrontImage2` (grayscale front)
- `OptionalDevices / NeedRearImage2` (grayscale rear)
- `OptionalDevices / NeedRearEndorser`
- `OptionalDevices / NeedIQA`
- `OptionalDevices / NeedIQAUpstream`
- `OptionalDevices / NeedIQADownstream`

Current React integration sets imaging + front/rear grayscale true for capture.

## Callback/Event Surface Provided by Ranger.js

Not all are currently consumed, but available:

- `TransportNewState`
- `TransportStartingUp`
- `TransportReadyToFeed`
- `TransportFeedingStopped`
- `TransportItemInPocket`
- `TransportNewItem`
- `TransportSetItemOutput`
- `TransportInExceptionState`
- `TransportTrackIsClear`
- `TransportPassThroughEvent`
- `RangerCallStatusCallback`
- `OnOpenCallback`
- `OnCloseCallback`
- `OnErrorCallback`
- `OnMessageCallback`

## Notes

- Default websocket URL comes from `GetUserDefinedUrl()` and points to:
  - `ws://127.0.0.1:9002`
- If scanner controls fail, verify Ranger Remote service is running locally and reachable on that websocket endpoint.





### WebSocket Testing (Ranger Remote)

To verify that the Ranger Remote WebSocket service is running and reachable (`ws://127.0.0.1:9002`), you can use the following methods:

---

#### 1. **Quick Browser Test (Manual)**

Open Chrome DevTools → Console and run:

```
const ws = new WebSocket("ws://127.0.0.1:9002");

ws.onopen = () => {
  console.log("✅ Connected to Ranger WebSocket");
  ws.send("ping"); // optional test message
};

ws.onmessage = (msg) => {
  console.log("📩 Message from server:", msg.data);
};

ws.onerror = (err) => {
  console.error("❌ WebSocket error:", err);
};

ws.onclose = () => {
  console.log("🔌 Connection closed");
};
```

👉 If `onopen` fires → connection is working.

