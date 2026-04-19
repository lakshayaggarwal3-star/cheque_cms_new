interface RangerClient {
  wsUrl: string;
  StartUp: () => Promise<boolean>;
  EnableOptions: () => Promise<boolean>;
  PrepareToChangeOptions: () => Promise<boolean>;
  StartFeeding: (feedType: number, feedCount: number) => Promise<boolean>;
  StopFeeding: () => Promise<boolean>;
  ShutDown: () => Promise<boolean>;
  SetGenericOption: (sectionName: string, valueName: string, value: string) => Promise<boolean>;
  GetImageBase64: (side: number, colorType: number) => string;
  GetMicrText: (line: number) => string;
  GetVersion?: () => string;
  GetTransportStateString?: () => string;
}

let rangerInstance: RangerClient | null = null;

function ensureRangerInstance(): RangerClient {
  if (!window.MakeRanger) {
    throw new Error('Ranger library not loaded. Ensure public/ranger scripts are available.');
  }
  if (!rangerInstance) {
    rangerInstance = new window.MakeRanger();
  }
  return rangerInstance;
}

export async function rangerStartup(wsUrl?: string): Promise<void> {
  const ranger = ensureRangerInstance();
  ranger.wsUrl = wsUrl || window.GetUserDefinedUrl?.() || 'ws://127.0.0.1:9002';
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
  if (options.enabled && options.text) {
    await ranger.SetGenericOption('EndorsementControl', 'FixedLine1', options.text);
  }
}

export function rangerGetCaptureData(side: 'Front' | 'Back' | 'Both') {
  const ranger = ensureRangerInstance();
  const includeFront = side === 'Front' || side === 'Both';
  const includeBack = side === 'Back' || side === 'Both';
  return {
    frontBase64: includeFront ? ranger.GetImageBase64(0, 1) : '',
    backBase64: includeBack ? ranger.GetImageBase64(1, 1) : '',
    micrRaw: ranger.GetMicrText(1) ?? '',
    version: ranger.GetVersion?.() ?? '',
    state: ranger.GetTransportStateString?.() ?? '',
  };
}
