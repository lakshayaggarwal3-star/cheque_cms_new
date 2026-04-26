export {};

declare global {
  interface Window {
    MakeRanger?: new () => RangerClient;
    GetUserDefinedUrl?: () => string;
  }

  interface RangerClient {
    wsUrl: string;
    TransportNewState: ((newState: number, previousState: number) => void) | null;
    StartUp: () => Promise<boolean>;
    EnableOptions: () => Promise<boolean>;
    PrepareToChangeOptions: () => Promise<boolean>;
    StartFeeding: (feedType: number, feedCount: number) => Promise<boolean>;
    StopFeeding: () => Promise<boolean>;
    ShutDown: () => Promise<boolean>;
    SetGenericOption: (sectionName: string, valueName: string, value: string) => Promise<boolean>;
    SetFixedEndorseText: (side: number, line: number, text: string) => Promise<boolean>;
    GetGenericOption: (sectionName: string, valueName: string) => string;
    GetImageBase64: (side: number, colorType: number) => string;
    GetMicrText: (line: number) => string;
    GetVersion?: () => string;
    GetTransportStateString?: () => string;
    GetInfo: (sectionName: string, valueName: string) => Promise<string>;
    GetRangerRemoteJSVersion: () => string;
    // Additional optional methods
    GetTransportInfo?: (sectionName: string, valueName: string) => string;
    // Callbacks
    TransportItemInPocket?: (itemID: string) => void;
    TransportReadyToSetEndorsement?: (side: number, mode: number) => void;
    TransportReadyToFeed?: (previousState?: number) => void;
  }
}
