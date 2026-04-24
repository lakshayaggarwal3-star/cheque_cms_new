export enum RangerTransportState {
  TransportUnknownState = -1,
  TransportShutDown = 0,
  TransportStartingUp = 1,
  TransportChangeOptions = 2,
  TransportEnablingOptions = 3,
  TransportReadyToFeed = 4,
  TransportFeeding = 5,
  TransportExceptionInProgress = 6,
  TransportShuttingDown = 7,
}

let rangerInstance: RangerClient | null = null;
let currentState: RangerTransportState = RangerTransportState.TransportShutDown;
let currentModel: string = '';
let stateListeners: Array<(state: RangerTransportState) => void> = [];
let modelListeners: Array<(model: string) => void> = [];
let itemListeners: Array<(data: any) => void> = [];
let endorsementProvider: (() => string) | null = null;

function ensureRangerInstance(): RangerClient {
  if (!window.MakeRanger) {
    throw new Error('Ranger library not loaded. Ensure public/ranger scripts are available.');
  }
  if (!rangerInstance) {
    rangerInstance = new window.MakeRanger();
    if (rangerInstance) {
      rangerInstance.TransportNewState = (newState: number) => {
        currentState = newState as RangerTransportState;
        stateListeners.forEach(l => l(currentState));
        // Read model when scanner finishes configuring (TransportChangeOptions = 2)
        if (newState === RangerTransportState.TransportChangeOptions) {
          try {
            const model: string = rangerInstance ? ((rangerInstance as any).GetTransportInfo('General', 'Model') ?? '') : '';
            if (model && model !== currentModel) {
              currentModel = model;
              modelListeners.forEach(l => l(currentModel));
            }
          } catch { /* GetTransportInfo not available yet */ }
        }
      };

      rangerInstance.TransportItemInPocket = (itemID: string) => {
        // Capture data immediately when item reaches pocket
        const data = rangerGetCaptureData('Both');
        itemListeners.forEach(l => l({ ...data, itemID }));
      };

      rangerInstance.TransportReadyToSetEndorsement = (side: number, mode: number) => {
        if (mode === 1 && endorsementProvider) {
          const text = endorsementProvider();
          // Set endorsement for the side requested by the scanner
          rangerInstance?.SetFixedEndorseText(side, 1, text);
        }
      };

      rangerInstance.TransportReadyToFeed = () => {
        if (endorsementProvider) {
          const text = endorsementProvider();
          // Set it for both potential rear endorser indices (1 and 2) to ensure it works across models
          rangerInstance?.SetFixedEndorseText(1, 1, text);
          rangerInstance?.SetFixedEndorseText(2, 1, text);
        }
      };
    }
  }
  return rangerInstance!;
}

export function subscribeToRangerState(callback: (state: RangerTransportState) => void) {
  stateListeners.push(callback);
  callback(currentState);
  return () => {
    stateListeners = stateListeners.filter(l => l !== callback);
  };
}

export function subscribeToRangerModel(callback: (model: string) => void) {
  modelListeners.push(callback);
  callback(currentModel);
  return () => {
    modelListeners = modelListeners.filter(l => l !== callback);
  };
}

export function getRangerModel(): string {
  return currentModel;
}

export function subscribeToRangerItems(callback: (data: any) => void) {
  itemListeners.push(callback);
  return () => {
    itemListeners = itemListeners.filter(l => l !== callback);
  };
}

export function setRangerEndorsementProvider(provider: (() => string) | null) {
  endorsementProvider = provider;
}

export function getRangerState(): RangerTransportState {
  return currentState;
}

export async function rangerStartup(wsUrl?: string): Promise<void> {
  const ranger = ensureRangerInstance();
  ranger.wsUrl = wsUrl || window.GetUserDefinedUrl?.() || 'ws://127.0.0.1:9002';
  
  if (currentState !== RangerTransportState.TransportShutDown && currentState !== RangerTransportState.TransportUnknownState) {
    return; // Already started or starting
  }

  const ok = await ranger.StartUp();
  if (!ok) throw new Error('Failed to startup Ranger connection.');
}

export async function rangerEnableOptions(): Promise<void> {
  const ranger = ensureRangerInstance();
  const ok = await ranger.EnableOptions();
  if (!ok) throw new Error('Ranger enable options failed.');
}

export async function rangerPrepareToChangeOptions(): Promise<void> {
  const ranger = ensureRangerInstance();
  if (currentState === RangerTransportState.TransportChangeOptions) return;
  const ok = await ranger.PrepareToChangeOptions();
  if (!ok) throw new Error('Ranger change options failed.');
}

export async function rangerStartFeeding(feedType = 0, feedCount = 0): Promise<void> {
  const ranger = ensureRangerInstance();
  const ok = await ranger.StartFeeding(feedType, feedCount);
  if (!ok) throw new Error('Ranger start feeding failed.');
}

export async function rangerStopFeeding(): Promise<void> {
  const ranger = ensureRangerInstance();
  const ok = await ranger.StopFeeding();
  if (!ok) throw new Error('Ranger stop feeding failed.');
}

export async function rangerShutdown(): Promise<void> {
  if (!rangerInstance) return;
  const ok = await rangerInstance.ShutDown();
  if (!ok) throw new Error('Ranger shutdown failed.');
  rangerInstance = null;
  currentState = RangerTransportState.TransportShutDown;
}

export async function rangerSetImagingOptions(options: {
  needImaging?: boolean;
  needFrontBitonal?: boolean;
  needRearBitonal?: boolean;
  needFrontGrayscale?: boolean;
  needRearGrayscale?: boolean;
}): Promise<void> {
  const ranger = ensureRangerInstance();
  const entries: Array<[string, boolean | undefined]> = [
    ['NeedImaging', options.needImaging],
    ['NeedFrontImage1', options.needFrontBitonal],
    ['NeedRearImage1', options.needRearBitonal],
    ['NeedFrontImage2', options.needFrontGrayscale],
    ['NeedRearImage2', options.needRearGrayscale],
  ];

  for (const [key, value] of entries) {
    if (typeof value === 'undefined') continue;
    const ok = await ranger.SetGenericOption('OptionalDevices', key, value ? 'true' : 'false');
    if (!ok) throw new Error(`Ranger option update failed for ${key}`);
  }
}

export async function rangerSetEndorsementOptions(options: {
  enabled: boolean;
  text?: string;
}): Promise<void> {
  const ranger = ensureRangerInstance();
  await ranger.SetGenericOption('OptionalDevices', 'NeedRearEndorser', options.enabled ? 'true' : 'false');
  await ranger.SetGenericOption('OptionalDevices', 'NeedFrontEndorser', options.enabled ? 'true' : 'false');
  if (options.enabled && options.text) {
    await ranger.SetGenericOption('EndorsementControl', 'FixedLine1', options.text);
  }
}

export function rangerGetCaptureData(side: 'Front' | 'Back' | 'Both') {
  const ranger = ensureRangerInstance();
  const includeFront = side === 'Front' || side === 'Both';
  const includeBack = side === 'Back' || side === 'Both';
  
  // Ranger Image Types: 0=Bitonal(TIFF), 1=Grayscale(JPEG), 2=Color(JPEG)
  const getImg = (sideIdx: number, type: number) => {
    return ranger.GetImageBase64(sideIdx, type) || '';
  };

    const micrLine = ranger.GetMicrText(1) || ranger.GetMicrText(0) || '';
    
    // Fallback parsing if individual fields are empty
    let m1 = ranger.GetMicrText(2) || '';
    let m2 = ranger.GetMicrText(3) || '';
    let m3 = ranger.GetMicrText(5) || '';

    if (!m1 && micrLine) {
      const parts = micrLine.toLowerCase().replace(/[abcd]/g, ' ').trim().split(/\s+/).filter(x => x.length > 0);
      m1 = parts[0] || '';
      m2 = parts[1] || '';
      m3 = parts[3] || parts[2] || '';
    }

    return {
      // Primary display images (JPEG Grayscale or Color)
      frontBase64: includeFront ? (getImg(0, 1) || getImg(0, 2) || getImg(0, 0)) : '',
      backBase64: includeBack ? (getImg(1, 1) || getImg(1, 2) || getImg(1, 0)) : '',
      
      // Archive images (TIFF Bitonal)
      frontTiffBase64: includeFront ? getImg(0, 0) : '',
      backTiffBase64: includeBack ? getImg(1, 0) : '',
  
      micrRaw: micrLine,
      scanMicr1: m1,
      scanMicr2: m2,
      scanMicr3: m3,
    };
}
