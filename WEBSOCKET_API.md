# WebSocket API Guide

This document explains how to run the scanner desktop app, connect to its local WebSocket API, send scanner commands, and handle the responses.

## Overview

The app exposes a local WebSocket endpoint on:

```text
ws://127.0.0.1:8765
```

This API is intended for local use only. It listens on `127.0.0.1`, so it is not exposed to other devices on the network.

The desktop app also serves its UI locally on:

```text
http://127.0.0.1:5004
```

## What Starts When the App Runs

When you launch `ScannerDesktopApp.exe` or run `python main.py`, the app starts:

1. The scanner service
2. The WebSocket server on port `8765`
3. The local UI server on port `5004`
4. The tray icon
5. The desktop window

When the window is closed:

- The app does not exit
- The window is hidden
- The WebSocket server keeps running
- The tray icon stays active

The app stops only when:

- You choose `Exit` from the tray menu
- Or you terminate the process manually

## How To Start Everything

### Option 1: Run the EXE

Open:

```text
dist\ScannerDesktopApp.exe
```

### Option 2: Run from Python

```powershell
.\venv\Scripts\activate
python main.py
```

## How To Stop Everything

### Recommended

Use the tray icon:

1. Find the scanner app icon in the Windows system tray
2. Right-click it
3. Click `Exit`

This performs a graceful shutdown of:

- the WebSocket server
- the local UI server
- the tray app
- the desktop window

### Not Recommended Unless Needed

You can also stop it from Task Manager by ending `ScannerDesktopApp.exe`, but that is a force stop.

## Connection Details

### WebSocket URL

```text
ws://127.0.0.1:8765
```

### Transport

- JSON messages over WebSocket
- One request per message
- One response per message

## Request Format

All requests use this structure:

```json
{
  "action": "scan",
  "params": {
    "scanner_id": "Canon LiDE 400",
    "resolution": 300,
    "mode": "Color",
    "format": "PNG"
  }
}
```

### Fields

- `action`: the command to execute
- `params`: an object containing the command parameters

## Response Format

All responses use this structure:

```json
{
  "status": "success",
  "data": {},
  "error": null
}
```

### Response Fields

- `status`: `success` or `error`
- `data`: action-specific result payload
- `error`: error message string, or `null`

Example error:

```json
{
  "status": "error",
  "data": null,
  "error": "scanner_id is required for scan."
}
```

## Supported Actions

- `detect_scanners`
- `auto_select`
- `get_scanner_info`
- `scan`
- `disconnect`

---

## 1. `detect_scanners`

Detects scanners using WIA, TWAIN, WMI, and registry information.

### Request

```json
{
  "action": "detect_scanners",
  "params": {}
}
```

### Success Response Example

```json
{
  "status": "success",
  "data": {
    "scanners": [
      {
        "source": "wia",
        "name": "Canon LiDE 400",
        "transport": "USB",
        "details": "Canon LiDE 400"
      },
      {
        "source": "twain",
        "name": "Canon LiDE 400",
        "transport": "USB",
        "details": "Canon LiDE 400"
      }
    ],
    "preferred_scanner": "Canon LiDE 400",
    "usb_scanners": [
      "Canon LiDE 400"
    ],
    "message": "[wia] Canon LiDE 400 [USB]\n[twain] Canon LiDE 400 [USB]"
  },
  "error": null
}
```

### What You Get

- `scanners`: all discovered scanner entries
- `preferred_scanner`: best candidate chosen by the service
- `usb_scanners`: deduplicated USB scanner names
- `message`: readable summary text

---

## 2. `auto_select`

Automatically chooses the best available scanner.

### Request

```json
{
  "action": "auto_select",
  "params": {}
}
```

### Success Response Example

```json
{
  "status": "success",
  "data": {
    "scanner_id": "Canon LiDE 400",
    "source": "wia",
    "message": "Auto-selected: Canon LiDE 400"
  },
  "error": null
}
```

### What You Get

- `scanner_id`: the selected scanner name
- `source`: which detection path selected it
- `message`: readable status

---

## 3. `get_scanner_info`

Returns capability and property information for a scanner.

### Request

```json
{
  "action": "get_scanner_info",
  "params": {
    "scanner_id": "Canon LiDE 400"
  }
}
```

### Success Response Example

```json
{
  "status": "success",
  "data": {
    "scanner_id": "Canon LiDE 400",
    "message": "Scanner: Canon LiDE 400\n============================================================\nConnection: WIA\n..."
  },
  "error": null
}
```

### What You Get

- `scanner_id`: the scanner that was queried
- `message`: a multiline text summary of supported properties and capabilities

---

## 4. `scan`

Starts a scan using the selected scanner and returns the result.

### Request

```json
{
  "action": "scan",
  "params": {
    "scanner_id": "Canon LiDE 400",
    "resolution": 300,
    "mode": "Color",
    "format": "PNG",
    "brightness": 0,
    "contrast": 0,
    "threshold": 128,
    "page_size": "Auto",
    "orientation": "Portrait",
    "duplex": "Simplex (One-sided)",
    "auto_crop": false,
    "auto_deskew": false,
    "include_base64": true
  }
}
```

### Scan Parameters

- `scanner_id`: required
- `resolution`: integer, `75` to `1200`
- `mode`: `Color`, `Gray`, or `Lineart`
- `format`: `PNG`, `JPEG`, `TIFF`, or `BMP`
- `brightness`: optional integer
- `contrast`: optional integer
- `threshold`: optional integer
- `page_size`: optional string
- `orientation`: optional string
- `duplex`: optional string
- `auto_crop`: optional boolean
- `auto_deskew`: optional boolean
- `include_base64`: optional boolean

### Success Response Example

```json
{
  "status": "success",
  "data": {
    "scanner_id": "Canon LiDE 400",
    "file_path": "C:\\Users\\YourUser\\AppData\\Local\\ScannerDesktopApp\\scans\\scan_300dpi_color_20260418_193000.png",
    "image_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
    "format": "PNG",
    "method": "WIA",
    "actual_settings": {
      "mode": "Color",
      "resolution": 300,
      "brightness": 0,
      "contrast": 0,
      "threshold": 128,
      "page_size": "Auto",
      "orientation": "Portrait",
      "duplex": "Simplex (One-sided)",
      "auto_crop": false,
      "auto_deskew": false,
      "color_dropout": "None"
    },
    "message": "Scan successful (WIA). Saved to C:\\Users\\YourUser\\AppData\\Local\\ScannerDesktopApp\\scans\\scan_300dpi_color_20260418_193000.png"
  },
  "error": null
}
```

### What You Get

- `file_path`: full saved image path on disk
- `image_base64`: image bytes encoded as base64 if `include_base64` is `true`
- `format`: actual output format
- `method`: `WIA` or `TWAIN`
- `actual_settings`: final settings used
- `message`: readable summary

## How Image Data Is Returned

There are two ways you can use the scanned image:

### 1. Use `file_path`

The scanner app saves the file locally and returns the absolute path:

```json
{
  "file_path": "C:\\Users\\YourUser\\AppData\\Local\\ScannerDesktopApp\\scans\\scan_300dpi_color_20260418_193000.png"
}
```

Use this if:

- your client runs on the same machine
- you want to load the file directly
- you do not want a large WebSocket payload

### 2. Use `image_base64`

The app can return the scanned image as base64:

```json
{
  "image_base64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

Use this if:

- you want immediate in-memory use
- you want to show the image directly in a UI
- you want to upload it elsewhere without reading from disk again

### HTML Image Example

For PNG:

```javascript
const base64 = response.data.image_base64;
const img = document.createElement("img");
img.src = `data:image/png;base64,${base64}`;
document.body.appendChild(img);
```

---

## 5. `disconnect`

Gracefully closes the WebSocket connection from the server side.

### Request

```json
{
  "action": "disconnect",
  "params": {}
}
```

### Success Response Example

```json
{
  "status": "success",
  "data": {
    "message": "Disconnecting..."
  },
  "error": null
}
```

### What Happens

- The server sends the success response
- The server then closes the WebSocket connection
- The client receives the response and then sees the connection close event
- No further commands can be sent on this connection
- The app remains running (it does not exit)
- You can reconnect to the same URL at any time
- Use this if you want to cleanly stop using the API from your client side

---

For JPEG:

```javascript
img.src = `data:image/jpeg;base64,${base64}`;
```

## JavaScript Example

```javascript
const ws = new WebSocket("ws://127.0.0.1:8765");

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: "detect_scanners",
    params: {}
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response);
};

ws.onerror = (error) => {
  console.error("WebSocket error", error);
};

ws.onclose = () => {
  console.log("Connection closed");
};
```

## Full Scan Example in JavaScript

```javascript
const ws = new WebSocket("ws://127.0.0.1:8765");

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: "scan",
    params: {
      scanner_id: "Canon LiDE 400",
      resolution: 300,
      mode: "Color",
      format: "PNG",
      include_base64: true
    }
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);

  if (response.status === "success") {
    console.log("Saved file:", response.data.file_path);
    console.log("Method:", response.data.method);

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${response.data.image_base64}`;
    document.body.appendChild(img);
  } else {
    console.error("Scan failed:", response.error);
  }
};
```

## Suggested Client Flow

Typical order for an integration:

1. Start the app
2. Connect to `ws://127.0.0.1:8765`
3. Call `detect_scanners`
4. Optionally call `auto_select`
5. Call `get_scanner_info`
6. Call `scan`
7. Read `file_path` or `image_base64`

## Setup Requirements

Before using the WebSocket API, make sure:

1. The app is running
2. Scanner drivers are installed
3. The scanner is connected by USB
4. No firewall rule is blocking local loopback traffic

If running from source, install:

```powershell
pip install -r requirements.txt
```

## Common Errors

### App not running

Symptom:

- WebSocket connection fails
- Connection refused on `127.0.0.1:8765`

Fix:

- Start the desktop app first

### Scanner not found

Symptom:

```json
{
  "status": "error",
  "error": "Scanner 'Canon LiDE 400' was not found."
}
```

Fix:

- Reconnect the scanner
- Run `detect_scanners`
- Use the exact returned scanner name

### Invalid scan request

Symptom:

```json
{
  "status": "error",
  "error": "resolution must be between 75 and 1200."
}
```

Fix:

- Validate request parameters before sending

### Scan fails after detection

Possible causes:

- scanner busy in another app
- WIA/TWAIN driver issue
- unsupported settings
- scanner powered off or disconnected

Fix:

- Close other scanner software
- try lower DPI
- try `Color` first
- try `PNG`
- rerun detection

## Security Notes

- The server binds only to `127.0.0.1`
- Only local machine clients can connect
- Requests are validated before actions are executed

## Quick Start Summary

1. Launch the app
2. Connect to `ws://127.0.0.1:8765`
3. Send:

```json
{"action":"detect_scanners","params":{}}
```

4. Then send:

```json
{"action":"scan","params":{"scanner_id":"Your Scanner Name","resolution":300,"mode":"Color","format":"PNG","include_base64":true}}
```

5. Read:

- `data.file_path`
- `data.image_base64`
- `data.method`
- `data.actual_settings`

