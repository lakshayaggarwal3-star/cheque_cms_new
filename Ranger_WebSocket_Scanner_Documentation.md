# Ranger WebSocket Scanner - Complete Implementation Guide

## Copyright Notice
Copyright © 2014-2021, Silver Bullet Technology, Inc.

---

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Prerequisites](#prerequisites)
4. [File Structure](#file-structure)
5. [Step-by-Step Implementation](#step-by-step-implementation)
6. [API Reference](#api-reference)
7. [Workflow Sequence](#workflow-sequence)
8. [Configuration Options](#configuration-options)
9. [Event Handling](#event-handling)
10. [Troubleshooting](#troubleshooting)
11. [Code Examples](#code-examples)

---

## Overview

The Ranger WebSocket Scanner is a browser-based interface for controlling Silver Bullet Technology's Ranger document scanner via WebSocket communication. It enables real-time scanning, image capture, MICR reading, endorsement, and quality assurance processing.

### Key Features
- Real-time WebSocket communication with scanner hardware
- Multi-format image capture (Bitonal, Grayscale)
- Front and rear imaging support
- MICR (Magnetic Ink Character Recognition) reading
- Document endorsement capabilities
- Image Quality Assessment (IQA)
- Base64 image transmission
- Asynchronous operation support

---

## System Architecture

```
┌─────────────────────┐
│   Web Browser       │
│  (HTML/JavaScript)  │
└──────────┬──────────┘
           │ WebSocket (ws://)
           │
┌──────────▼──────────┐
│  Ranger Remote      │
│  WebSocket Server   │
│  (Port 9002)        │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Ranger Scanner     │
│  Hardware Device    │
└─────────────────────┘
```

---

## Prerequisites

### Hardware Requirements
- Silver Bullet Technology Ranger scanner device
- Computer with scanner drivers installed
- Network connectivity (localhost or LAN)

### Software Requirements
- Modern web browser (Chrome, Firefox, Edge, Safari)
- WebSocket support enabled
- JavaScript enabled
- Ranger Remote WebSocket Server running on port 9002

### Required Files
1. **Ranger.js** - Core JavaScript library
2. **DefaultWebSocketUrl.js** - WebSocket URL configuration
3. **sbullet.css** - Stylesheet for UI
4. **RangerImageFromBase64.html** - HTML implementation example

---

## File Structure

### 1. Ranger.js
**Purpose**: Core library containing all scanner control logic

**Key Components**:
- WebSocket connection management
- Scanner state machine
- Image processing and Base64 encoding
- Event callback system
- MICR data handling
- Logging functionality

**Version**: Check via `Ranger.GetRangerRemoteJSVersion()`

### 2. DefaultWebSocketUrl.js
**Purpose**: Configure WebSocket server URL

```javascript
function GetUserDefinedUrl() {
  return "ws://127.0.0.1:9002"  // Default local connection
}
```

**Customization**:
- Change IP address for remote scanners
- Modify port if using custom configuration
- Use secure WebSocket (wss://) if SSL enabled

### 3. sbullet.css
**Purpose**: Stylesheet for consistent UI appearance

**Key Styles**:
- Container layout (800px centered)
- Button controls (150px width)
- Data cell formatting
- Banner and footer styling

### 4. RangerImageFromBase64.html
**Purpose**: Complete working example implementation

---

## Step-by-Step Implementation

### Phase 1: Initial Setup

#### Step 1: Include Required Files
```html
<!DOCTYPE html>
<html lang="en-US">
<head>
   <link type="text/css" href="sbullet.css" rel="stylesheet" media="screen" />
   <title>Ranger WebSocket Example Page</title>
   <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
   
   <!-- Include JavaScript files in order -->
   <script src="Ranger.js"></script>
   <script src="DefaultWebSocketUrl.js"></script>
</head>
```

**Order is critical**: Ranger.js must load before your custom scripts.

#### Step 2: Initialize Global Variables
```javascript
var Ranger;              // Main Ranger instance
var dateObj = new Date(); // For timing operations
var countTime = 0;        // Performance counter
var itemCount = 0;        // Document counter
```

#### Step 3: Create onLoad Function
```javascript
function onLoadFunction() {
   try {
      // Display Ranger JS version
      document.getElementById("RangerRemoteJSVersion").innerHTML = 
         "Ranger Remote JS version:" + Ranger.GetRangerRemoteJSVersion();
      
      // Set WebSocket URL
      document.getElementById("url").value = GetUserDefinedUrl();
   } catch (err) {
      console.error("Initialization error:", err);
   }
}
```

#### Step 4: Attach onLoad to Body
```html
<body onload="onLoadFunction()">
```

---

### Phase 2: WebSocket Connection

#### Step 5: Create StartUpRanger Function
```javascript
function StartUpRanger() {
   try {
      // Get WebSocket URL from input field
      var url = document.getElementById("url").value;
      
      // Initialize Ranger instance with callbacks
      Ranger = new RangerRemote(
         url,                    // WebSocket URL
         OnRangerOpen,          // Connection opened callback
         OnRangerStateChange,   // State change callback
         OnRangerItemInPocket,  // Item scanned callback
         OnRangerError,         // Error callback
         OnRangerImageDataReady // Image ready callback
      );
      
      // Disable startup button
      document.getElementById('StartRanger').disabled = true;
      
   } catch (err) {
      console.error("Startup failed:", err);
      alert("Failed to start Ranger: " + err.message);
   }
}
```

**Critical**: This is the FIRST API call - nothing works without it.

---

### Phase 3: Callback Implementation

#### Step 6: Implement OnRangerOpen Callback
```javascript
function OnRangerOpen() {
   console.log("WebSocket connection established");
   
   // Update connection status
   document.getElementById('ConnectionStatus').innerHTML = 
      'WS: Connected';
   
   // Enable Edit Options button
   document.getElementById('EditOptions').disabled = false;
   
   // Retrieve scanner information
   document.getElementById('RangerVersion').innerHTML = 
      'Ranger Version: ' + Ranger.GetRangerVersion();
   
   document.getElementById('RangerRemoteVersion').innerHTML = 
      'Ranger Remote Version: ' + Ranger.GetRangerRemoteVersion();
   
   document.getElementById('ScannerModel').innerHTML = 
      'Scanner Model: ' + Ranger.GetGenericOption("Options", "ScannerModel");
   
   document.getElementById('RatedSpeed').innerHTML = 
      'Rated Speed: ' + Ranger.GetGenericOption("Options", "RatedSpeed") + ' DPM';
   
   // Update status
   getstatus();
}
```

**What happens here**: 
- WebSocket connection confirmed
- Scanner metadata retrieved
- UI updated with device information
- Options button enabled

#### Step 7: Implement OnRangerStateChange Callback
```javascript
function OnRangerStateChange(state, oldstate) {
   console.log("State changed from", oldstate, "to", state);
   
   // Update status display
   getstatus();
   
   // Handle specific state transitions
   switch(state) {
      case "ReadyToEnable":
         document.getElementById("EnableRanger").disabled = false;
         document.getElementById("EditOptions").disabled = false;
         document.getElementById('UserInstructions').innerHTML = 
            'Press "Enable Options" to activate scanner with current settings';
         break;
         
      case "ReadyToFeed":
         document.getElementById("StartFeeding").disabled = false;
         document.getElementById("ChangeOptions").disabled = false;
         document.getElementById("Shutdown").disabled = false;
         document.getElementById('UserInstructions').innerHTML = 
            'Scanner ready. Press "Start Feeding" to begin scanning';
         break;
         
      case "Feeding":
         document.getElementById("StopFeeding").disabled = false;
         document.getElementById('UserInstructions').innerHTML = 
            'Scanner is feeding. Insert documents or press "Stop Feeding"';
         break;
         
      case "Idle":
         document.getElementById('UserInstructions').innerHTML = 
            'Scanner idle. Press "Start Feeding" to resume';
         document.getElementById("StartFeeding").disabled = false;
         document.getElementById("StopFeeding").disabled = true;
         break;
         
      case "ShuttingDown":
         document.getElementById('UserInstructions').innerHTML = 
            'Scanner shutting down...';
         DisableBtnsForShutdown();
         break;
   }
}

// Helper function to get current status
function getstatus() {
   document.getElementById('Status').innerHTML = 
      'Status: ' + Ranger.GetTransportStateString();
}
```

**State Machine Flow**:
```
Disconnected → Connected → ReadyToEnable → ReadyToFeed → Feeding → Idle
                                              ↑              ↓
                                              └──────────────┘
```

#### Step 8: Implement OnRangerItemInPocket Callback
```javascript
function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   console.log("Document scanned:", DocNumber);
   
   itemCount++;
   
   // Display MICR data if available
   if (MICRObj && MICRObj.Length > 0) {
      var micrText = "MICR Data:<br>";
      micrText += "Raw Data: " + MICRObj.RawData + "<br>";
      micrText += "Account: " + MICRObj.AccountNumber + "<br>";
      micrText += "Routing: " + MICRObj.RoutingNumber + "<br>";
      micrText += "Serial: " + MICRObj.SerialNumber + "<br>";
      micrText += "Amount: " + MICRObj.Amount + "<br>";
      
      document.getElementById('MICR').innerHTML = micrText;
   }
   
   // Update document counter
   document.getElementById('UserInstructions').innerHTML = 
      'Documents scanned: ' + itemCount;
   
   // Request images for this document
   Ranger.GetBase64Image(
      DocNumber,     // Document number
      FrontSerial,   // Front image serial
      RearSerial,    // Rear image serial
      "FrontGray",   // Front image type
      "RearGray"     // Rear image type
   );
}
```

**MICR Object Structure**:
```javascript
{
   Length: <number of MICR fields>,
   RawData: <raw MICR string>,
   AccountNumber: <parsed account>,
   RoutingNumber: <parsed routing>,
   SerialNumber: <check serial>,
   Amount: <check amount>,
   TransitNumber: <transit number>,
   OnUs: <OnUs field>
}
```

#### Step 9: Implement OnRangerImageDataReady Callback
```javascript
function OnRangerImageDataReady(FrontImageType, RearImageType, 
                                FrontImageString, RearImageString) {
   console.log("Images ready");
   
   // Display front image
   if (FrontImageString && FrontImageString.length > 0) {
      var frontImg = document.getElementById('FrontGrayImage');
      frontImg.src = 'data:image/png;base64,' + FrontImageString;
      frontImg.style.visibility = 'visible';
   }
   
   // Display rear image
   if (RearImageString && RearImageString.length > 0) {
      var rearImg = document.getElementById('RearGrayImage');
      rearImg.src = 'data:image/png;base64,' + RearImageString;
      rearImg.style.visibility = 'visible';
   }
}
```

**Image Types Supported**:
- `FrontBitonal` - Front black & white (1-bit)
- `FrontGray` - Front grayscale (8-bit)
- `FrontColor` - Front color (24-bit)
- `RearBitonal` - Rear black & white
- `RearGray` - Rear grayscale
- `RearColor` - Rear color

#### Step 10: Implement OnRangerError Callback
```javascript
function OnRangerError(errorMessage) {
   console.error("Ranger error:", errorMessage);
   
   // Display error to user
   alert("Scanner Error: " + errorMessage);
   
   // Log error details
   document.getElementById('UserInstructions').innerHTML = 
      '<span style="color:red">Error: ' + errorMessage + '</span>';
   
   // Optionally reset scanner
   // Ranger.ResetScanner();
}
```

---

### Phase 4: Configuration

#### Step 11: Create Options Configuration
```javascript
function popup(obj, L, T) {
   // Disable control buttons during configuration
   DisableAllButtons();
   
   // Load current options into form
   LoadCurrentOptions();
   
   // Display options dialog
   document.getElementById('editsettings').style.display = 'block';
}

function LoadCurrentOptions() {
   // Imaging options
   if (Ranger.GetGenericOption("OptionalDevices", "NeedImaging") == "true") {
      document.getElementById("EnableImagingTrue").checked = true;
   }
   
   if (Ranger.GetGenericOption("OptionalDevices", "NeedFrontImage1") == "true") {
      document.getElementById("FrontBitonalTrue").checked = true;
   }
   
   if (Ranger.GetGenericOption("OptionalDevices", "NeedRearImage1") == "true") {
      document.getElementById("RearBitonalTrue").checked = true;
   }
   
   if (Ranger.GetGenericOption("OptionalDevices", "NeedFrontImage2") == "true") {
      document.getElementById("FrontGrayscaleTrue").checked = true;
   }
   
   if (Ranger.GetGenericOption("OptionalDevices", "NeedRearImage2") == "true") {
      document.getElementById("RearGrayscaleTrue").checked = true;
   }
   
   // Endorsement options
   if (Ranger.GetGenericOption("OptionalDevices", "NeedRearEndorser") == "true") {
      document.getElementById("NeedRearEndorserTrue").checked = true;
   }
   
   // IQA options
   if (Ranger.GetGenericOption("OptionalDevices", "NeedIQA") == "true") {
      document.getElementById("NeedIQATrue").checked = true;
   }
}
```

#### Step 12: Apply Options Configuration
```javascript
function OptionsOK(obj) {
   // Set feed mode
   var feedMode = document.getElementById("FeedMode").value;
   Ranger.SetGenericOption("Options", "FeedMode", feedMode);
   
   // Set feed count
   var feedCount = document.getElementById("feedcount").value;
   Ranger.SetGenericOption("Options", "FeedCount", feedCount);
   
   // Configure imaging
   var enableImaging = document.querySelector('input[name="EnableImaging"]:checked').value;
   Ranger.SetGenericOption("OptionalDevices", "NeedImaging", enableImaging);
   
   if (enableImaging == "true") {
      // Front bitonal
      var frontBitonal = document.querySelector('input[name="FrontBitonal"]:checked').value;
      Ranger.SetGenericOption("OptionalDevices", "NeedFrontImage1", frontBitonal);
      
      // Rear bitonal
      var rearBitonal = document.querySelector('input[name="RearBitonal"]:checked').value;
      Ranger.SetGenericOption("OptionalDevices", "NeedRearImage1", rearBitonal);
      
      // Front grayscale
      var frontGray = document.querySelector('input[name="FrontGrayscale"]:checked').value;
      Ranger.SetGenericOption("OptionalDevices", "NeedFrontImage2", frontGray);
      
      // Rear grayscale
      var rearGray = document.querySelector('input[name="RearGrayscale"]:checked').value;
      Ranger.SetGenericOption("OptionalDevices", "NeedRearImage2", rearGray);
   }
   
   // Configure endorsement
   var needEndorser = document.querySelector('input[name="NeedRearEndorser"]:checked').value;
   Ranger.SetGenericOption("OptionalDevices", "NeedRearEndorser", needEndorser);
   
   if (needEndorser == "true") {
      var endorsementText = document.getElementById("FixedLine1").value;
      Ranger.SetGenericOption("EndorsementControl", "FixedLine1", endorsementText);
   }
   
   // Configure IQA
   var needIQA = document.querySelector('input[name="NeedIQA"]:checked').value;
   Ranger.SetGenericOption("OptionalDevices", "NeedIQA", needIQA);
   
   if (needIQA == "true") {
      var iqaUpstream = document.querySelector('input[name="NeedIQAUpstream"]:checked').value;
      Ranger.SetGenericOption("OptionalDevices", "NeedIQAUpstream", iqaUpstream);
      
      var iqaDownstream = document.querySelector('input[name="NeedIQADownstream"]:checked').value;
      Ranger.SetGenericOption("OptionalDevices", "NeedIQADownstream", iqaDownstream);
   }
   
   // Close dialog
   unpop(obj);
}

function unpop(obj) {
   document.getElementById('editsettings').style.display = 'none';
   
   // Re-enable buttons
   document.getElementById('EnableRanger').disabled = false;
   document.getElementById('EditOptions').disabled = false;
}
```

---

### Phase 5: Scanner Operations

#### Step 13: Enable Scanner
```javascript
function EnableRanger() {
   DisableBtnsForEnableRanger();
   Ranger.EnableOptions();
   
   // Wait for OnRangerStateChange callback
   // Scanner will transition to "ReadyToFeed" state
}

function DisableBtnsForEnableRanger() {
   document.getElementById("EditOptions").disabled = true;
   document.getElementById("EnableRanger").disabled = true;
}
```

**API Call**: `Ranger.EnableOptions()`

**What it does**: 
- Applies all configured options to scanner
- Initializes hardware components
- Prepares scanner for feeding
- Triggers state change to "ReadyToFeed"

#### Step 14: Start Feeding
```javascript
function DemoStartFeed() {
   DisableBtnsForStartFeeding();
   
   // Reset counters
   itemCount = 0;
   countTime = 0;
   dateObj = new Date();
   
   // Clear previous images
   document.getElementById('FrontGrayImage').style.visibility = 'hidden';
   document.getElementById('RearGrayImage').style.visibility = 'hidden';
   
   // Start feeding
   Ranger.StartFeeding();
}

function DisableBtnsForStartFeeding() {
   document.getElementById("StartFeeding").disabled = true;
   document.getElementById("ChangeOptions").disabled = true;
}
```

**API Call**: `Ranger.StartFeeding()`

**What it does**:
- Activates feeder mechanism
- Begins document transport
- Scanner enters "Feeding" state
- Waits for documents to be inserted

#### Step 15: Stop Feeding
```javascript
function StopFeeding() {
   Ranger.StopFeeding();
   document.getElementById("StopFeeding").disabled = true;
   
   // Calculate performance metrics
   var endTime = new Date();
   var elapsedSeconds = (endTime - dateObj) / 1000;
   var documentsPerMinute = (itemCount / elapsedSeconds) * 60;
   
   console.log("Scanned", itemCount, "documents in", elapsedSeconds, "seconds");
   console.log("Performance:", documentsPerMinute.toFixed(2), "DPM");
}
```

**API Call**: `Ranger.StopFeeding()`

**What it does**:
- Stops feeder mechanism
- Completes processing of documents in transport
- Scanner returns to "Idle" state
- Allows option changes or shutdown

#### Step 16: Change Options (Mid-Session)
```javascript
function PrepareToChangeOptions() {
   DisableBtnsForChangeOptions();
   Ranger.PrepareToChangeOptions();
   
   // Wait for state change to "ReadyToEnable"
   // Then user can edit and re-enable with new options
}

function DisableBtnsForChangeOptions() {
   document.getElementById("ChangeOptions").disabled = true;
   document.getElementById("StartFeeding").disabled = true;
}
```

**API Call**: `Ranger.PrepareToChangeOptions()`

**Workflow**:
1. Scanner stops feeding
2. Current settings disabled
3. State changes to "ReadyToEnable"
4. User edits options
5. Call `EnableOptions()` again
6. Resume scanning with new settings

#### Step 17: Shutdown Scanner
```javascript
function ShutdownRanger() {
   DisableBtnsForShutdown();
   Ranger.ShutDown();
   
   // Wait for complete shutdown
   // WebSocket will close
   // Page may need refresh to restart
}

function DisableBtnsForShutdown() {
   document.getElementById("EditOptions").disabled = true;
   document.getElementById("EnableRanger").disabled = true;
   document.getElementById("StartFeeding").disabled = true;
   document.getElementById("StopFeeding").disabled = true;
   document.getElementById("ChangeOptions").disabled = true;
   document.getElementById("Shutdown").disabled = true;
}
```

**API Call**: `Ranger.ShutDown()`

**What it does**:
- Safely stops all operations
- Releases scanner hardware
- Closes WebSocket connection
- Requires page reload to restart

---

### Phase 6: Advanced Features

#### Step 18: Logging and Diagnostics
```javascript
// Download Ranger client logs
async function CallGetRangerLogging() {
   await Ranger.GetRangerLogging();
   // Triggers download of client-side log file
}

// Download Ranger server logs
async function CallGetRangerServerLogging() {
   await Ranger.GetRangerServerLogging();
   // Triggers download of server-side log file
}

// Helper function to download logs
var DownloadLogs = function(filename, data, contenttype) {
   if (!data) return;
   
   if (!filename) {
      filename = 'RRConsole.txt';
   }
   
   var blob = new Blob([data], {type:'text/json'});
   
   // Detect IE/Edge
   if (document.documentMode || /Edge/.test(navigator.userAgent)) {
      navigator.msSaveBlob(blob, filename);
   } else {
      var a = document.createElement('a');
      a.download = filename;
      a.href = window.URL.createObjectURL(blob);
      a.click();
   }
};
```

**Log Types**:
- **Client logs**: JavaScript console and events
- **Server logs**: WebSocket server and device driver logs
- **Bloodhound logs**: IQA failure details (see scanner application)

#### Step 19: Custom Image Processing
```javascript
function ProcessCustomImages(DocNumber, FrontSerial, RearSerial) {
   // Request specific image types
   Ranger.GetBase64Image(
      DocNumber,
      FrontSerial,
      RearSerial,
      "FrontColor",    // Request color front
      "RearBitonal"    // Request bitonal rear
   );
}

// Handle in OnRangerImageDataReady callback
function OnRangerImageDataReady(FrontType, RearType, FrontData, RearData) {
   if (FrontType === "FrontColor") {
      // Process color image
      processColorImage(FrontData);
   }
   
   if (RearType === "RearBitonal") {
      // Process bitonal image
      processBitonalImage(RearData);
   }
}

function processColorImage(base64Data) {
   // Convert to canvas for manipulation
   var img = new Image();
   img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Apply custom processing
      // ... your image processing code ...
      
      // Display result
      ctx.putImageData(imageData, 0, 0);
      document.body.appendChild(canvas);
   };
   img.src = 'data:image/png;base64,' + base64Data;
}
```

---

## API Reference

### Core Constructor

#### `new RangerRemote(url, onOpen, onStateChange, onItemInPocket, onError, onImageReady)`

Creates a new Ranger instance and establishes WebSocket connection.

**Parameters**:
- `url` (string): WebSocket URL (e.g., "ws://127.0.0.1:9002")
- `onOpen` (function): Callback when connection established
- `onStateChange` (function): Callback when scanner state changes
- `onItemInPocket` (function): Callback when document scanned
- `onError` (function): Callback when error occurs
- `onImageReady` (function): Callback when images are ready

**Returns**: RangerRemote instance

**Example**:
```javascript
Ranger = new RangerRemote(
   "ws://127.0.0.1:9002",
   OnRangerOpen,
   OnRangerStateChange,
   OnRangerItemInPocket,
   OnRangerError,
   OnRangerImageDataReady
);
```

---

### Information Methods

#### `GetRangerVersion()`
Returns Ranger firmware version.

**Returns**: String (e.g., "3.2.1.0")

#### `GetRangerRemoteVersion()`
Returns Ranger Remote server version.

**Returns**: String (e.g., "2.1.0.5")

#### `GetRangerRemoteJSVersion()`
Returns JavaScript library version.

**Returns**: String (e.g., "1.5.2")

#### `GetTransportStateString()`
Returns current scanner state as string.

**Returns**: String
- "Disconnected"
- "Connected"
- "ReadyToEnable"
- "ReadyToFeed"
- "Feeding"
- "Idle"
- "ShuttingDown"

---

### Configuration Methods

#### `GetGenericOption(section, key)`
Retrieves a configuration value.

**Parameters**:
- `section` (string): Configuration section
- `key` (string): Configuration key

**Common Sections & Keys**:

**Options**:
- `ScannerModel` - Model name
- `RatedSpeed` - DPM rating
- `FeedMode` - "MainHopper", "ManualDrop", "ManualID"
- `FeedCount` - Number to feed (0 = continuous)

**OptionalDevices**:
- `NeedImaging` - Enable imaging ("true"/"false")
- `NeedFrontImage1` - Front bitonal
- `NeedRearImage1` - Rear bitonal
- `NeedFrontImage2` - Front grayscale
- `NeedRearImage2` - Rear grayscale
- `NeedRearEndorser` - Enable endorsement
- `NeedIQA` - Enable IQA
- `NeedIQAUpstream` - IQA in SetItemOutput
- `NeedIQADownstream` - IQA in ItemInPocket

**EndorsementControl**:
- `FixedLine1` - Endorsement text line 1
- `FixedLine2` - Endorsement text line 2

**Returns**: String value

**Example**:
```javascript
var model = Ranger.GetGenericOption("Options", "ScannerModel");
var needImaging = Ranger.GetGenericOption("OptionalDevices", "NeedImaging");
```

#### `SetGenericOption(section, key, value)`
Sets a configuration value.

**Parameters**:
- `section` (string): Configuration section
- `key` (string): Configuration key  
- `value` (string): Value to set

**Returns**: void

**Example**:
```javascript
Ranger.SetGenericOption("Options", "FeedMode", "MainHopper");
Ranger.SetGenericOption("OptionalDevices", "NeedImaging", "true");
Ranger.SetGenericOption("EndorsementControl", "FixedLine1", "SCANNED 2024");
```

---

### Operation Methods

#### `EnableOptions()`
Applies configuration and enables scanner.

**Precondition**: State must be "ReadyToEnable"

**Effect**: 
- Applies all configured options
- Initializes hardware
- Changes state to "ReadyToFeed"

**Returns**: void

#### `StartFeeding()`
Starts document feeding.

**Precondition**: State must be "ReadyToFeed" or "Idle"

**Effect**:
- Activates feeder
- Changes state to "Feeding"
- Waits for documents

**Returns**: void

#### `StopFeeding()`
Stops document feeding.

**Precondition**: State must be "Feeding"

**Effect**:
- Deactivates feeder
- Completes documents in transport
- Changes state to "Idle"

**Returns**: void

#### `PrepareToChangeOptions()`
Prepares scanner for option changes.

**Precondition**: State must be "ReadyToFeed" or "Idle"

**Effect**:
- Disables current configuration
- Changes state to "ReadyToEnable"
- Allows option editing

**Returns**: void

#### `ShutDown()`
Safely shuts down scanner.

**Effect**:
- Stops all operations
- Releases hardware
- Closes WebSocket
- Changes state to "Disconnected"

**Returns**: void

---

### Image Methods

#### `GetBase64Image(docNumber, frontSerial, rearSerial, frontType, rearType)`
Requests Base64-encoded images for a document.

**Parameters**:
- `docNumber` (number): Document identifier from OnRangerItemInPocket
- `frontSerial` (number): Front image serial from OnRangerItemInPocket
- `rearSerial` (number): Rear image serial from OnRangerItemInPocket
- `frontType` (string): Desired front image type
- `rearType` (string): Desired rear image type

**Image Types**:
- `"FrontBitonal"` - Front B&W (1-bit)
- `"FrontGray"` - Front grayscale (8-bit)
- `"FrontColor"` - Front color (24-bit)
- `"RearBitonal"` - Rear B&W
- `"RearGray"` - Rear grayscale
- `"RearColor"` - Rear color

**Effect**: Triggers OnRangerImageDataReady callback when ready

**Returns**: void

**Example**:
```javascript
Ranger.GetBase64Image(
   DocNumber,
   FrontSerial,
   RearSerial,
   "FrontGray",
   "RearBitonal"
);
```

---

### Logging Methods

#### `GetRangerLogging()`
Retrieves client-side logs.

**Returns**: Promise that resolves when download starts

**Usage**:
```javascript
async function CallGetRangerLogging() {
   await Ranger.GetRangerLogging();
}
```

#### `GetRangerServerLogging()`
Retrieves server-side logs.

**Returns**: Promise that resolves when download starts

**Usage**:
```javascript
async function CallGetRangerServerLogging() {
   await Ranger.GetRangerServerLogging();
}
```

---

## Workflow Sequence

### Complete Scanning Session

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PAGE LOAD                                                │
│    - Include Ranger.js, DefaultWebSocketUrl.js             │
│    - Call onLoadFunction()                                  │
│    - Display version info                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. STARTUP RANGER (User clicks "Startup Ranger")           │
│    API: new RangerRemote(url, callbacks...)                │
│    - Creates Ranger instance                                │
│    - Opens WebSocket connection                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ON RANGER OPEN (Callback triggered)                     │
│    - Connection established                                 │
│    - Retrieve scanner information                           │
│    - Enable "Edit Options" button                           │
│    State: Connected                                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EDIT OPTIONS (User clicks "Edit Options")               │
│    - Display options dialog                                 │
│    - Load current settings                                  │
│    - User configures:                                       │
│      * Feed mode (MainHopper/ManualDrop/ManualID)          │
│      * Imaging options (Front/Rear, Bitonal/Grayscale)     │
│      * Endorsement settings                                 │
│      * IQA settings                                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. APPLY OPTIONS (User clicks "OK")                        │
│    API: SetGenericOption() for each setting                │
│    - Save all configuration values                          │
│    - Close options dialog                                   │
│    - Enable "Enable Options" button                         │
│    State: ReadyToEnable                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. ENABLE RANGER (User clicks "Enable Options")            │
│    API: EnableOptions()                                     │
│    - Apply configuration to hardware                        │
│    - Initialize components                                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. ON STATE CHANGE (Callback triggered)                    │
│    - State changes to "ReadyToFeed"                         │
│    - Enable "Start Feeding" button                          │
│    - Enable "Change Options" button                         │
│    - Enable "Shutdown" button                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. START FEEDING (User clicks "Start Feeding")             │
│    API: StartFeeding()                                      │
│    - Activate feeder mechanism                              │
│    - Reset counters and timers                              │
│    State: Feeding                                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. DOCUMENT INSERTION                                       │
│    - User inserts documents into feeder                     │
│    - Scanner transports document                            │
│    - Imaging and MICR capture occurs                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. ON ITEM IN POCKET (Callback triggered for each doc)    │
│     Parameters: DocNumber, FrontSerial, RearSerial,        │
│                 PocketNumber, MICRObj                       │
│     - Document completed transport                          │
│     - MICR data available                                   │
│     - Request images via GetBase64Image()                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. ON IMAGE DATA READY (Callback triggered)               │
│     Parameters: FrontType, RearType,                        │
│                 FrontBase64, RearBase64                     │
│     - Display images on page                                │
│     - Process/save images as needed                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. LOOP: Steps 9-11 repeat for each document              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 13. STOP FEEDING (User clicks "Stop Feeding")              │
│     API: StopFeeding()                                      │
│     - Deactivate feeder                                     │
│     - Complete documents in transport                       │
│     - Calculate performance metrics                         │
│     State: Idle                                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 14. OPTIONAL: CHANGE OPTIONS                                │
│     API: PrepareToChangeOptions()                           │
│     - Return to step 4                                      │
│     - Edit and re-enable with new settings                  │
│     OR                                                       │
│     Resume feeding (return to step 8)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 15. SHUTDOWN (User clicks "Shutdown Ranger")               │
│     API: ShutDown()                                         │
│     - Stop all operations                                   │
│     - Release hardware                                      │
│     - Close WebSocket                                       │
│     State: Disconnected                                     │
│     - Requires page refresh to restart                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Options

### Feed Modes

#### MainHopper
- **Description**: Automatic feeding from main input tray
- **Use Case**: Batch scanning of stacked documents
- **Feed Count**: Set number of documents (0 = continuous)

#### ManualDrop
- **Description**: Documents manually inserted one at a time
- **Use Case**: Single-document verification, mixed media
- **Feed Count**: Typically 1 or 0 for continuous manual feed

#### ManualID
- **Description**: Manual insertion with ID verification
- **Use Case**: Identity document scanning (licenses, passports)
- **Feed Count**: Typically 1

### Imaging Configuration Matrix

| Option | Description | File Size | Use Case |
|--------|-------------|-----------|----------|
| Front Bitonal | B&W front (1-bit) | Smallest | Text documents, checks |
| Rear Bitonal | B&W rear (1-bit) | Smallest | Endorsement verification |
| Front Grayscale | 8-bit front | Medium | Photos, signatures |
| Rear Grayscale | 8-bit rear | Medium | General purpose |
| Front Color | 24-bit front | Largest | Color logos, security features |
| Rear Color | 24-bit rear | Largest | Full-color capture |

**Performance Impact**:
- More image types = slower throughput
- Color images significantly larger than grayscale
- Bitonal fastest for check processing

**Typical Configurations**:

**Check Scanning**:
```javascript
NeedFrontImage1: true   // Front bitonal
NeedRearImage1: true    // Rear bitonal (for endorsement)
NeedFrontImage2: false
NeedRearImage2: false
```

**Document Archival**:
```javascript
NeedFrontImage1: false
NeedRearImage1: false
NeedFrontImage2: true   // Front grayscale
NeedRearImage2: true    // Rear grayscale
```

**ID Verification**:
```javascript
NeedFrontImage1: false
NeedRearImage1: false
NeedFrontImage2: true   // Front color (or grayscale)
NeedRearImage2: true    // Rear color (or grayscale)
```

### Endorsement Options

#### Basic Endorsement
```javascript
SetGenericOption("OptionalDevices", "NeedRearEndorser", "true");
SetGenericOption("EndorsementControl", "FixedLine1", "PROCESSED 2024-01-15");
```

#### Dynamic Endorsement (with variables)
```javascript
// Use special tokens:
// %DATE% - Current date
// %TIME% - Current time
// %SEQ% - Sequential number
// %MICR% - MICR data

SetGenericOption("EndorsementControl", "FixedLine1", "SCAN %DATE% %TIME%");
SetGenericOption("EndorsementControl", "FixedLine2", "DOC# %SEQ%");
```

### IQA (Image Quality Assessment)

#### Upstream IQA
- **Location**: SetItemOutput event
- **Purpose**: Reject before pocket
- **Action**: Document can be diverted to reject pocket

```javascript
SetGenericOption("OptionalDevices", "NeedIQA", "true");
SetGenericOption("OptionalDevices", "NeedIQAUpstream", "true");
```

#### Downstream IQA
- **Location**: ItemInPocket event
- **Purpose**: Quality reporting after pocket
- **Action**: Log quality issues, flag for review

```javascript
SetGenericOption("OptionalDevices", "NeedIQA", "true");
SetGenericOption("OptionalDevices", "NeedIQADownstream", "true");
```

**IQA Checks**:
- Image focus/sharpness
- Proper exposure
- Skew detection
- Document size validation
- MICR read quality

---

## Event Handling

### Callback Timing Diagram

```
Time →
│
├─ WebSocket Opens
│  └─→ OnRangerOpen()
│      └─ Get scanner info
│
├─ User enables options
│  └─→ EnableOptions() called
│      └─→ OnRangerStateChange(ReadyToFeed)
│
├─ User starts feeding
│  └─→ StartFeeding() called
│      └─→ OnRangerStateChange(Feeding)
│
├─ Document 1 inserted
│  └─→ Scanner processes
│      └─→ OnRangerItemInPocket(DocNum=1, ...)
│          ├─ MICR data provided
│          └─→ GetBase64Image() called
│              └─→ OnRangerImageDataReady()
│                  └─ Images displayed
│
├─ Document 2 inserted
│  └─→ OnRangerItemInPocket(DocNum=2, ...)
│      └─→ GetBase64Image()
│          └─→ OnRangerImageDataReady()
│
├─ User stops feeding
│  └─→ StopFeeding() called
│      └─→ OnRangerStateChange(Idle)
│
└─ User shuts down
   └─→ ShutDown() called
       └─→ OnRangerStateChange(ShuttingDown)
           └─ WebSocket closes
```

### Error Handling Strategy

```javascript
function OnRangerError(errorMessage) {
   console.error("Ranger Error:", errorMessage);
   
   // Categorize error
   if (errorMessage.includes("Paper Jam")) {
      handlePaperJam();
   } else if (errorMessage.includes("Hardware")) {
      handleHardwareError();
   } else if (errorMessage.includes("Communication")) {
      handleCommError();
   } else {
      handleGenericError(errorMessage);
   }
}

function handlePaperJam() {
   alert("Paper jam detected. Please clear the feeder and press OK.");
   // Don't auto-restart - wait for user action
   document.getElementById('UserInstructions').innerHTML = 
      'Clear paper jam, then click Start Feeding to resume';
}

function handleHardwareError() {
   alert("Hardware error. Scanner may need service.");
   // Log for diagnostics
   CallGetRangerServerLogging();
   // Attempt soft reset
   Ranger.PrepareToChangeOptions();
}

function handleCommError() {
   alert("Communication error. Checking connection...");
   // Check WebSocket state
   if (Ranger.GetTransportStateString() === "Disconnected") {
      // Attempt reconnection
      location.reload();
   }
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. WebSocket Connection Fails

**Symptom**: "Failed to connect" error, OnRangerOpen never called

**Causes**:
- Ranger Remote server not running
- Incorrect WebSocket URL
- Firewall blocking port 9002
- Scanner not connected/powered on

**Solutions**:
```javascript
// Verify server is running
// Check: Task Manager (Windows) or Activity Monitor (Mac)
// Process: RangerRemote.exe or similar

// Test connection manually
var testWS = new WebSocket("ws://127.0.0.1:9002");
testWS.onopen = function() { 
   console.log("Connection successful"); 
   testWS.close(); 
};
testWS.onerror = function(err) { 
   console.error("Connection failed:", err); 
};

// Change URL if needed
document.getElementById("url").value = "ws://192.168.1.100:9002";
```

**Firewall Configuration**:
- Windows: Allow inbound TCP port 9002
- Mac: System Preferences → Security → Firewall → Add RangerRemote
- Network: Ensure local network allows WebSocket traffic

#### 2. Images Not Displaying

**Symptom**: OnRangerItemInPocket called but images don't show

**Causes**:
- Imaging not enabled
- Wrong image type requested
- Base64 data corrupt
- Image elements not in DOM

**Solutions**:
```javascript
// Verify imaging is enabled
console.log("Imaging:", Ranger.GetGenericOption("OptionalDevices", "NeedImaging"));

// Check specific image types
console.log("Front Gray:", Ranger.GetGenericOption("OptionalDevices", "NeedFrontImage2"));

// Debug in OnRangerImageDataReady
function OnRangerImageDataReady(FrontType, RearType, FrontData, RearData) {
   console.log("Image callback triggered");
   console.log("Front:", FrontType, "Length:", FrontData ? FrontData.length : 0);
   console.log("Rear:", RearType, "Length:", RearData ? RearData.length : 0);
   
   if (FrontData && FrontData.length > 0) {
      // Verify Base64 format
      if (FrontData.match(/^[A-Za-z0-9+/=]+$/)) {
         console.log("Front Base64 valid");
      } else {
         console.error("Front Base64 invalid");
      }
   }
   
   // ... rest of function
}

// Ensure img elements exist
if (!document.getElementById('FrontGrayImage')) {
   console.error("Front image element missing from DOM");
}
```

#### 3. MICR Data Not Reading

**Symptom**: OnRangerItemInPocket provides empty or null MICR object

**Causes**:
- Document doesn't have MICR line
- MICR line damaged/faint
- Scanner not configured for MICR
- Wrong document orientation

**Solutions**:
```javascript
function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   if (!MICRObj || MICRObj.Length === 0) {
      console.warn("No MICR data for document", DocNumber);
      
      // Check if document should have MICR
      // Log for manual review
      document.getElementById('MICR').innerHTML = 
         '<span style="color:orange">No MICR data - verify document type</span>';
   } else {
      // MICR present - validate
      if (!MICRObj.RoutingNumber || MICRObj.RoutingNumber.length !== 9) {
         console.warn("Invalid routing number:", MICRObj.RoutingNumber);
      }
      
      // Display all MICR fields
      console.log("MICR Raw:", MICRObj.RawData);
      console.log("Routing:", MICRObj.RoutingNumber);
      console.log("Account:", MICRObj.AccountNumber);
   }
}
```

**MICR Testing**:
- Use known-good check
- Verify check orientation (MICR line at bottom)
- Check scanner MICR head cleanliness
- Review Ranger configuration for MICR settings

#### 4. Scanner Jams Frequently

**Symptom**: Frequent "Paper Jam" errors

**Causes**:
- Mixed document sizes
- Damaged/wrinkled documents
- Incorrect feed settings
- Hardware issue (rollers worn)

**Solutions**:
```javascript
// Monitor jam rate
var jamCount = 0;
var totalDocs = 0;

function OnRangerError(errorMessage) {
   if (errorMessage.includes("Paper Jam")) {
      jamCount++;
      console.warn("Jam rate:", ((jamCount / totalDocs) * 100).toFixed(2) + "%");
      
      if (jamCount / totalDocs > 0.10) {
         alert("High jam rate detected. Check document quality or scanner maintenance.");
      }
   }
}

function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   totalDocs++;
}
```

**Maintenance Checks**:
- Clean scanner rollers
- Check for debris in feed path
- Inspect documents before scanning
- Sort documents by size
- Reduce feeder stack height

#### 5. Slow Performance

**Symptom**: Scanner running slower than rated speed

**Causes**:
- Too many image types enabled
- Network latency (if remote)
- IQA processing overhead
- Browser processing bottleneck

**Solutions**:
```javascript
// Measure actual performance
var perfStartTime;
var perfDocCount = 0;

function DemoStartFeed() {
   perfStartTime = new Date();
   perfDocCount = 0;
   // ... rest of function
}

function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   perfDocCount++;
   
   var elapsed = (new Date() - perfStartTime) / 1000;
   var dpm = (perfDocCount / elapsed) * 60;
   
   console.log("Current speed:", dpm.toFixed(0), "DPM");
   
   // Compare to rated speed
   var ratedSpeed = parseInt(Ranger.GetGenericOption("Options", "RatedSpeed"));
   if (dpm < ratedSpeed * 0.7) {
      console.warn("Performance below 70% of rated speed");
   }
}

// Optimization: Only request needed images
function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   // Only get front grayscale if needed
   if (needToArchive(DocNumber)) {
      Ranger.GetBase64Image(DocNumber, FrontSerial, RearSerial, "FrontGray", "");
   }
   // Skip image request if just counting
}
```

**Performance Tips**:
- Minimize enabled image types
- Use bitonal instead of grayscale when possible
- Disable IQA if not needed
- Process images asynchronously
- Consider server-side processing for high volumes

#### 6. State Machine Stuck

**Symptom**: Scanner won't transition to expected state

**Causes**:
- Missed state transition
- Hardware not responding
- Incorrect API call sequence

**Solutions**:
```javascript
// State transition monitoring
var lastState = "";
var stateChangeTime = new Date();

function OnRangerStateChange(state, oldstate) {
   var now = new Date();
   var timeInState = (now - stateChangeTime) / 1000;
   
   console.log("State:", oldstate, "→", state, "(", timeInState.toFixed(1), "s in", oldstate, ")");
   
   lastState = oldstate;
   stateChangeTime = now;
   
   // Detect stuck states
   if (timeInState > 60) {
      console.error("State", oldstate, "exceeded 60 seconds");
      // Consider timeout action
   }
   
   // Handle expected vs actual
   if (state !== expectedNextState) {
      console.warn("Unexpected state transition");
   }
}

// Force state check
function checkState() {
   var currentState = Ranger.GetTransportStateString();
   console.log("Current state:", currentState);
   return currentState;
}

// Recovery function
function resetScanner() {
   console.log("Attempting scanner reset");
   if (Ranger.GetTransportStateString() !== "Disconnected") {
      Ranger.ShutDown();
      setTimeout(function() {
         location.reload();
      }, 5000);
   }
}
```

---

## Code Examples

### Minimal Implementation

```html
<!DOCTYPE html>
<html>
<head>
   <title>Minimal Ranger Example</title>
   <script src="Ranger.js"></script>
   <script src="DefaultWebSocketUrl.js"></script>
   <script>
      var Ranger;
      
      function startScanner() {
         Ranger = new RangerRemote(
            GetUserDefinedUrl(),
            function() { 
               console.log("Connected");
               Ranger.SetGenericOption("OptionalDevices", "NeedImaging", "true");
               Ranger.SetGenericOption("OptionalDevices", "NeedFrontImage2", "true");
               Ranger.EnableOptions();
            },
            function(state) { 
               console.log("State:", state);
               if (state === "ReadyToFeed") {
                  Ranger.StartFeeding();
               }
            },
            function(doc, fs, rs, pocket, micr) {
               console.log("Doc", doc, "scanned");
               Ranger.GetBase64Image(doc, fs, rs, "FrontGray", "");
            },
            function(err) { 
               console.error(err); 
            },
            function(ft, rt, fd, rd) {
               if (fd) {
                  console.log("Image received, length:", fd.length);
                  var img = document.createElement('img');
                  img.src = 'data:image/png;base64,' + fd;
                  document.body.appendChild(img);
               }
            }
         );
      }
   </script>
</head>
<body>
   <button onclick="startScanner()">Start Scanner</button>
</body>
</html>
```

### Batch Processing with Progress

```javascript
var batchConfig = {
   totalExpected: 100,
   processed: 0,
   failed: 0,
   startTime: null
};

function startBatchScan(expectedCount) {
   batchConfig.totalExpected = expectedCount;
   batchConfig.processed = 0;
   batchConfig.failed = 0;
   batchConfig.startTime = new Date();
   
   // Set feed count
   Ranger.SetGenericOption("Options", "FeedCount", expectedCount.toString());
   Ranger.SetGenericOption("Options", "FeedMode", "MainHopper");
   
   // Enable and start
   Ranger.EnableOptions();
}

function OnRangerStateChange(state, oldstate) {
   if (state === "ReadyToFeed") {
      Ranger.StartFeeding();
      updateProgress();
   }
   
   if (state === "Idle" && batchConfig.processed > 0) {
      // Batch complete
      completeBatch();
   }
}

function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   batchConfig.processed++;
   
   // Validate MICR
   if (!MICRObj || MICRObj.Length === 0) {
      batchConfig.failed++;
      console.warn("Document", DocNumber, "- No MICR data");
   }
   
   updateProgress();
   
   // Request images
   Ranger.GetBase64Image(DocNumber, FrontSerial, RearSerial, "FrontGray", "RearGray");
}

function updateProgress() {
   var pct = (batchConfig.processed / batchConfig.totalExpected * 100).toFixed(1);
   var elapsed = (new Date() - batchConfig.startTime) / 1000;
   var dpm = (batchConfig.processed / elapsed * 60).toFixed(0);
   
   document.getElementById('progress').innerHTML = 
      'Progress: ' + batchConfig.processed + '/' + batchConfig.totalExpected + 
      ' (' + pct + '%) - ' + dpm + ' DPM - Failures: ' + batchConfig.failed;
}

function completeBatch() {
   var elapsed = (new Date() - batchConfig.startTime) / 1000;
   var avgDpm = (batchConfig.processed / elapsed * 60).toFixed(0);
   
   console.log("Batch complete:");
   console.log("  Processed:", batchConfig.processed);
   console.log("  Failed:", batchConfig.failed);
   console.log("  Time:", elapsed.toFixed(0), "seconds");
   console.log("  Avg Speed:", avgDpm, "DPM");
   
   alert("Batch scanning complete!\n" +
         "Processed: " + batchConfig.processed + "\n" +
         "Failed: " + batchConfig.failed + "\n" +
         "Avg Speed: " + avgDpm + " DPM");
}
```

### Quality Control with IQA

```javascript
var qcData = {
   total: 0,
   iqaPass: 0,
   iqaFail: 0,
   failureReasons: {}
};

function setupQualityControl() {
   // Enable IQA
   Ranger.SetGenericOption("OptionalDevices", "NeedIQA", "true");
   Ranger.SetGenericOption("OptionalDevices", "NeedIQADownstream", "true");
   
   // Enable imaging for visual inspection of failures
   Ranger.SetGenericOption("OptionalDevices", "NeedImaging", "true");
   Ranger.SetGenericOption("OptionalDevices", "NeedFrontImage2", "true");
}

function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   qcData.total++;
   
   // Get IQA results (if scanner provides them)
   var iqaResult = Ranger.GetGenericOption("IQA", "LastResult");
   
   if (iqaResult === "Pass") {
      qcData.iqaPass++;
   } else if (iqaResult === "Fail") {
      qcData.iqaFail++;
      
      var reason = Ranger.GetGenericOption("IQA", "FailureReason");
      qcData.failureReasons[reason] = (qcData.failureReasons[reason] || 0) + 1;
      
      console.warn("IQA Failure - Doc", DocNumber, "Reason:", reason);
      
      // Request images for manual review
      Ranger.GetBase64Image(DocNumber, FrontSerial, RearSerial, "FrontGray", "");
   }
   
   updateQCStats();
}

function updateQCStats() {
   var passRate = (qcData.iqaPass / qcData.total * 100).toFixed(1);
   
   var stats = 
      'Total: ' + qcData.total + ' | ' +
      'Pass: ' + qcData.iqaPass + ' (' + passRate + '%) | ' +
      'Fail: ' + qcData.iqaFail;
   
   document.getElementById('qcStats').innerHTML = stats;
   
   // Display failure breakdown
   if (qcData.iqaFail > 0) {
      var breakdown = '<br>Failure Reasons:<br>';
      for (var reason in qcData.failureReasons) {
         breakdown += '  ' + reason + ': ' + qcData.failureReasons[reason] + '<br>';
      }
      document.getElementById('qcBreakdown').innerHTML = breakdown;
   }
}

function getQCReport() {
   return {
      summary: {
         total: qcData.total,
         passed: qcData.iqaPass,
         failed: qcData.iqaFail,
         passRate: (qcData.iqaPass / qcData.total * 100).toFixed(2) + '%'
      },
      failureBreakdown: qcData.failureReasons
   };
}
```

### Image Export to Server

```javascript
var exportQueue = [];

function OnRangerImageDataReady(FrontType, RearType, FrontData, RearData) {
   // Queue images for upload
   var imageSet = {
      timestamp: new Date().toISOString(),
      frontType: FrontType,
      rearType: RearType,
      frontImage: FrontData,
      rearImage: RearData
   };
   
   exportQueue.push(imageSet);
   
   // Display locally
   displayImages(FrontData, RearData);
   
   // Upload asynchronously
   uploadImages(imageSet);
}

function uploadImages(imageSet) {
   // Convert to proper format for server
   var payload = {
      timestamp: imageSet.timestamp,
      images: [
         {
            type: imageSet.frontType,
            format: 'png',
            data: imageSet.frontImage
         },
         {
            type: imageSet.rearType,
            format: 'png',
            data: imageSet.rearImage
         }
      ]
   };
   
   // Send to server
   fetch('/api/scanner/upload', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
   })
   .then(response => response.json())
   .then(data => {
      console.log('Upload successful:', data.imageId);
      // Remove from queue
      var index = exportQueue.indexOf(imageSet);
      if (index > -1) {
         exportQueue.splice(index, 1);
      }
   })
   .catch(error => {
      console.error('Upload failed:', error);
      // Retry logic could go here
   });
}

// Retry failed uploads
function retryFailedUploads() {
   console.log('Retrying', exportQueue.length, 'failed uploads');
   exportQueue.forEach(imageSet => {
      uploadImages(imageSet);
   });
}
```

---

## Security Considerations

### WebSocket Security

**Local Network Only**:
- Default `ws://127.0.0.1:9002` is localhost only
- No external access by default
- Firewall protects against outside connections

**Secure WebSocket (WSS)**:
```javascript
// If server supports SSL/TLS
function GetUserDefinedUrl() {
   return "wss://scanner.company.local:9003"
}
```

**Access Control**:
- Implement authentication in your application layer
- Control which users can access scanner
- Log all scan operations for audit trail

### Data Privacy

**MICR Data**:
- Contains sensitive financial information
- Encrypt before transmission or storage
- Comply with PCI-DSS if processing payments

```javascript
function OnRangerItemInPocket(DocNumber, FrontSerial, RearSerial, PocketNumber, MICRObj) {
   if (MICRObj && MICRObj.AccountNumber) {
      // Mask account number in logs
      console.log("Account:", maskAccount(MICRObj.AccountNumber));
      
      // Encrypt before storage
      var encrypted = encryptData(JSON.stringify(MICRObj));
      storeSecurely(DocNumber, encrypted);
   }
}

function maskAccount(accountNum) {
   if (accountNum.length > 4) {
      return '*'.repeat(accountNum.length - 4) + accountNum.slice(-4);
   }
   return accountNum;
}
```

**Image Data**:
- Images may contain PII (Personally Identifiable Information)
- Implement access controls
- Consider data retention policies
- Secure deletion when no longer needed

### Best Practices

1. **Validate Input**: Check all user-provided options
2. **Error Handling**: Never expose system paths or internals in errors
3. **Logging**: Log operations but redact sensitive data
4. **Updates**: Keep Ranger.js and server components updated
5. **Network**: Use HTTPS for web interface even if WebSocket is local

---

## Conclusion

This documentation covers the complete implementation of the Ranger WebSocket Scanner system. Follow the step-by-step workflow for successful integration, reference the API documentation for specific methods, and use the code examples as starting templates for your application.

### Quick Start Checklist

- [ ] Install Ranger Remote WebSocket Server
- [ ] Verify scanner is connected and powered on
- [ ] Include Ranger.js and DefaultWebSocketUrl.js in HTML
- [ ] Implement required callbacks (OnRangerOpen, OnRangerStateChange, OnRangerItemInPocket, OnRangerError, OnRangerImageDataReady)
- [ ] Create StartUpRanger function with proper URL
- [ ] Configure scanning options (imaging, endorsement, IQA)
- [ ] Test connection and state transitions
- [ ] Implement image handling and display
- [ ] Add error handling and logging
- [ ] Test with actual documents
- [ ] Implement production features (upload, storage, etc.)

### Support Resources

- **Technical Issues**: Review server logs via GetRangerServerLogging()
- **Hardware Problems**: Consult scanner maintenance guide
- **Performance**: Monitor DPM and adjust configuration
- **Development**: Use browser console for debugging

For additional support, contact Silver Bullet Technology, Inc.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Copyright**: © 2014-2021, Silver Bullet Technology, Inc.
