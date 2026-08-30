
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

export interface ProcessingResult {
  idcBundles: IdcBundle[];
  summaryBlob: Blob;
  summaryName: string;
  businessPackages: BusinessPackage[];
  routeTextData: RouteTextData[];
  summaryRows: any[];
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
