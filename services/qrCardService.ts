import QRCode from 'qrcode';
import { DispatchCard, StationCode, RouteSummaryItem, BusinessPackage } from '../types';

/**
 * Generate QR code data URL from any payload
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

/**
 * Creates dispatch cards from manifest summary items
 */
export async function createDispatchCardsFromManifest(
  station: StationCode,
  summaryRows: any[],
  businessPackages: BusinessPackage[] = [],
  dateStr: string = new Date().toISOString().split('T')[0],
  shift: string = 'Standard Morning'
): Promise<DispatchCard[]> {
  const cards: DispatchCard[] = [];

  for (let i = 0; i < summaryRows.length; i++) {
    const row = summaryRows[i];
    const route = String(row.Route || `RT-${i + 1}`).trim().toUpperCase();
    const idc = String(row.IDC || 'Depot Hub').trim();
    const packageCount = Number(row.packageCount) || 0;
    const seqRange = String(row.seqRange || (packageCount ? `1 - ${packageCount}` : '-')).trim();
    
    // Count business stops for this route
    const bizStops = businessPackages.filter(b => b.route.toUpperCase() === route).length;
    const specialBizNote = bizStops > 0 ? `${bizStops} Time-Sensitive Business Stop${bizStops > 1 ? 's' : ''}` : '';

    // Standard structured QR payload for Dragonfly check-in check-out scanners
    // Payload format: DFLY|CHECKIN|{STATION}|{ROUTE}|{DATE}|{IDC}|{PKGS}
    const qrPayload = `DFLY|CARD|${station}|${route}|${dateStr}|${encodeURIComponent(idc)}|${packageCount}`;
    const qrDataUrl = await generateQrDataUrl(qrPayload);

    cards.push({
      id: `card-${station}-${route}-${Date.now()}-${i}`,
      route,
      station,
      idc,
      date: dateStr,
      shift,
      driverName: '',
      driverPhone: '',
      vehicleNumber: '',
      packageCount,
      seqRange,
      businessStopsCount: bizStops,
      specialNotes: specialBizNote,
      qrPayload,
      qrDataUrl,
      status: 'pending'
    });
  }

  return cards;
}

/**
 * Creates a blank/manual dispatch card template
 */
export async function createManualDispatchCard(
  station: StationCode,
  route: string,
  idc: string = 'Primary Hub',
  packageCount: number = 0,
  seqRange: string = '1 - 100',
  driverName: string = '',
  dateStr: string = new Date().toISOString().split('T')[0]
): Promise<DispatchCard> {
  const normalizedRoute = route.trim().toUpperCase();
  const qrPayload = `DFLY|CARD|${station}|${normalizedRoute}|${dateStr}|${encodeURIComponent(idc)}|${packageCount}`;
  const qrDataUrl = await generateQrDataUrl(qrPayload);

  return {
    id: `card-${station}-${normalizedRoute}-${Date.now()}`,
    route: normalizedRoute,
    station,
    idc,
    date: dateStr,
    shift: 'Standard Dispatch',
    driverName,
    driverPhone: '',
    vehicleNumber: '',
    packageCount,
    seqRange,
    businessStopsCount: 0,
    specialNotes: '',
    qrPayload,
    qrDataUrl,
    status: 'pending'
  };
}
