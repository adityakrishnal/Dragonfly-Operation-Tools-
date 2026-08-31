
export type StationCode = 'KTCH' | 'LNDN';

export interface StationInfo {
  code: StationCode;
  name: string;
  prefix: string;
  location: string;
  description: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface ProcessingStats {
  totalRoutes: number;
  processedRoutes: number;
  totalPages: number;
  routesFound: number;
  routesMissing: number;
}

export interface ExcelRow {
  Route: string;
  IDC: string | number;
  [key: string]: any;
}

export interface RouteMapping {
  route: string;
  idc: string;
}

export interface IdcBundle {
  name: string;
  filename: string;
  blob: Blob;
  routeCount: number;
}

export interface BusinessPackage {
  route: string;
  idc: string;
  seq: string;
  seqCount: number;
  address: string;
  closing: string;
  instr: string;
  unitNote?: string;
  isPossibleBusiness?: boolean;
}

export interface RouteTextData {
  route: string;
  idc: string;
  text: string;
}

export interface RouteSummaryItem {
  Route: string;
  IDC: string;
  "Pages Found": number;
  "QR Attached": string;
  "Business Stops": number;
  Status: string;
  packageCount?: number;
  seqRange?: string;
}

export interface ProcessingResult {
  idcBundles: IdcBundle[];
  summaryBlob: Blob;
  summaryName: string;
  businessPackages: BusinessPackage[];
  routeTextData: RouteTextData[];
  summaryRows: any[];
  station?: StationCode;
}

export interface DispatchCard {
  id: string;
  route: string;
  station: StationCode;
  idc: string;
  date: string;
  shift: string;
  driverName: string;
  driverPhone?: string;
  vehicleNumber?: string;
  packageCount: number;
  seqRange: string;
  businessStopsCount: number;
  specialNotes?: string;
  qrPayload: string;
  qrDataUrl?: string;
  // Dispatch status
  status: 'pending' | 'checked_out' | 'checked_in' | 'flagged';
  checkOutTime?: string;
  checkOutOdometer?: string;
  checkOutDispatcher?: string;
  checkInTime?: string;
  checkInOdometer?: string;
  checkInDispatcher?: string;
  deliveredCount?: number;
  returnedCount?: number;
  returnReason?: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_FILES = 'READING_FILES',
  SCANNING_PDF = 'SCANNING_PDF',
  ANALYZING_BUSINESSES = 'ANALYZING_BUSINESSES',
  GENERATING_FILES = 'GENERATING_FILES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface OperatorProfile {
  name: string;
  designation: string;
}

export const DESIGNATION_OPTIONS = [
  'Operations Supervisor',
  'Operations Coordinator',
  'Operations Lead Hand',
  'Station Manager'
] as const;

export type DesignationType = typeof DESIGNATION_OPTIONS[number];

export interface ParsedManifestRoute {
  id: string;
  routeCode: string;
  station: StationCode;
  rawHeading: string;
  packageCount?: number;
  stopCount?: number;
  seqRange?: string;
  idcName?: string;
  waveNumber?: string;
  waveTime?: string;
  driverNumber?: string;
  notes?: string;
  hasQr: boolean;
  qrConfidence?: 'confirmed' | 'detected' | 'none';
  qrPayloadPreview?: string;
  isFlagged: boolean;
  flagReason?: string;
  selected: boolean;
  pageNumber?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CardGeneratorSettings {
  // Field Positions for Top Card (Page Y: 400-780pt)
  topCard: {
    station: { x: number; y: number };
    date: { x: number; y: number };
    route: { x: number; y: number };
    wave: { x: number; y: number };
    idcName: { x: number; y: number };
    waveTime: { x: number; y: number };
    driverNumber: { x: number; y: number };
    checkInTime: { x: number; y: number };
    checkOutTime: { x: number; y: number };
    notes: { x: number; y: number };
    qrCode: { x: number; y: number; size: number };
  };
  // Field Positions for Bottom Card (Page Y: 20-390pt)
  bottomCard: {
    station: { x: number; y: number };
    date: { x: number; y: number };
    route: { x: number; y: number };
    wave: { x: number; y: number };
    idcName: { x: number; y: number };
    waveTime: { x: number; y: number };
    driverNumber: { x: number; y: number };
    checkInTime: { x: number; y: number };
    checkOutTime: { x: number; y: number };
    notes: { x: number; y: number };
    qrCode: { x: number; y: number; size: number };
  };
  // Layout Options
  showCutLine: boolean;
  includeQrCode: boolean;
  includeDiscrepancyTable: boolean;
  fontSize: number; // default: 11
  routeFontSize: number; // default: 18
  defaultWave: string; // default: 'Wave 1'
  defaultWaveTime: string; // default: '07:30 AM'
  defaultIdcName: string; // default: 'Depot A'
  defaultApprovedBy: string; // default: 'Ops Dispatcher'
  useCustomTemplate: boolean;
}

// Big Box Mapping & Excel Automation Types
// A "scanned box" is one physical scan event on the warehouse floor: either a
// tracking ID barcode (auto-resolves its route from the manifest) or a raw
// route number typed/scanned directly. 'NEXT COLUMN' entries are column-break
// markers, not real boxes.
export interface BigBoxScannedItem {
  id: string;
  position: number;
  boxId: string;
  route: string;
  trackingId?: string;
  manifestIndex?: string;
}

// One row of the uploaded manifest: which route + stop index a tracking ID
// belongs to. Used to auto-resolve scans and to flag unmatched tracking IDs.
export interface BigBoxManifestPackage {
  trackingId: string;
  route: string;
  manifestIndex: string;
}

export interface BigBoxSheet3Row {
  route: string;
  count: number;
  indices: string;
}

export interface BigBoxSheet2Row {
  route: string;
  routeTotal: number;
  totalArea: number;
  colCounts: Record<number, number>;
}

export interface BigBoxSheet1Row {
  date: string;
  position: number;
  physicalCol: number;
  boxId: string;
  route: string;
  tracking_id: string;
  raw_tracking_id: string;
  isMatched: boolean;
  hasUnderscore: boolean;
  manifest_index: string;
}

// Persisted per station+date in localStorage so a page refresh on the
// warehouse floor doesn't lose an in-progress scanning session.
export interface BigBoxSessionState {
  date: string;
  station: StationCode;
  scannedItems: BigBoxScannedItem[];
  manifestPackages: BigBoxManifestPackage[];
}

