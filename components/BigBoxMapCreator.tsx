import React, { useState, useMemo } from 'react';
import { StationCode, OperatorProfile, BigBoxItem, BigBoxZone, BigBoxStagingBay, DESIGNATION_OPTIONS } from '../types';
import { DragonflyLogoGraphic } from './DragonflyLogo';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Package,
  MapPin,
  Layers,
  Truck,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  User,
  SlidersHorizontal,
  Calendar,
  Grid,
  FileSpreadsheet,
  ArrowRight,
  Info,
  ShieldAlert,
  Boxes,
  Plus,
  RefreshCw,
  Eye,
  ChevronRight,
  Tag,
  Check
} from 'lucide-react';

interface BigBoxMapCreatorProps {
  currentStation: StationCode;
  onSelectStation: (station: StationCode) => void;
  operatorProfile: OperatorProfile;
  onUpdateOperator: (profile: OperatorProfile) => void;
  currentDate: string;
  onSelectDate: (date: string) => void;
  onBackToHub: () => void;
}

// Pre-seeded Zone configurations
const STATION_ZONES: Record<StationCode, BigBoxZone[]> = {
  KTCH: [
    { id: 'z-ktch-1', code: 'KTCH-Z1', name: 'Downtown Kitchener & Central', station: 'KTCH', color: '#00A68F', description: 'Core urban core, mixed commercial & high-density residential', itemCount: 14, totalWeightKg: 420, assignedBay: 'Bay 1 & 2' },
    { id: 'z-ktch-2', code: 'KTCH-Z2', name: 'Waterloo Tech Corridor & Univ', station: 'KTCH', color: '#0ea5e9', description: 'University Ave, Northfield Dr, student high-rises & office parks', itemCount: 12, totalWeightKg: 360, assignedBay: 'Bay 3 & 4' },
    { id: 'z-ktch-3', code: 'KTCH-Z3', name: 'Cambridge Industrial & South', station: 'KTCH', color: '#f59e0b', description: 'Hespeler, Galt, Preston commercial distribution corridors', itemCount: 11, totalWeightKg: 390, assignedBay: 'Bay 5 & 6' },
    { id: 'z-ktch-4', code: 'KTCH-Z4', name: 'Guelph & Outlying East', station: 'KTCH', color: '#8b5cf6', description: 'Speedvale, Stone Rd, suburban estates & rural transitions', itemCount: 8, totalWeightKg: 280, assignedBay: 'Bay 7 & 8' },
    { id: 'z-ktch-5', code: 'KTCH-Z5', name: 'Elmira & Township Rural', station: 'KTCH', color: '#ec4899', description: 'North Woolwich, Wellesley, long-distance agricultural routes', itemCount: 6, totalWeightKg: 240, assignedBay: 'Bay 9 & 10' },
  ],
  LNDN: [
    { id: 'z-lndn-1', code: 'LNDN-Z1', name: 'London North & Masonville', station: 'LNDN', color: '#00A68F', description: 'Fanshawe Park Rd, Richmond St North, Sunningdale estates', itemCount: 15, totalWeightKg: 480, assignedBay: 'Bay 1 & 2' },
    { id: 'z-lndn-2', code: 'LNDN-Z2', name: 'Downtown, Old South & Westmount', station: 'LNDN', color: '#0ea5e9', description: 'Dundas St, Wonderland Rd, mixed multi-family apartments', itemCount: 13, totalWeightKg: 410, assignedBay: 'Bay 3 & 4' },
    { id: 'z-lndn-3', code: 'LNDN-Z3', name: 'London East & Airport Industrial', station: 'LNDN', color: '#f59e0b', description: 'Veterans Memorial Pkwy, Clarke Rd, commercial depots', itemCount: 12, totalWeightKg: 395, assignedBay: 'Bay 5 & 6' },
    { id: 'z-lndn-4', code: 'LNDN-Z4', name: 'St. Thomas & South Shore', station: 'LNDN', color: '#8b5cf6', description: 'Talbot St, Sunset Dr, Port Stanley suburban transit', itemCount: 9, totalWeightKg: 310, assignedBay: 'Bay 7 & 8' },
    { id: 'z-lndn-5', code: 'LNDN-Z5', name: 'Strathroy & Western Corridor', station: 'LNDN', color: '#ec4899', description: 'Hwy 81, Caradoc, Komoka residential and rural deliveries', itemCount: 7, totalWeightKg: 260, assignedBay: 'Bay 9 & 10' },
  ]
};

// Initial Seed Parcels
const SEED_BIG_BOX_ITEMS: Record<StationCode, BigBoxItem[]> = {
  KTCH: [
    { id: 'bb-k-1', trackingNumber: 'DFLY-KT-849101', routeCode: 'KTCH101', station: 'KTCH', zone: 'KTCH-Z1', stagingBay: 'Bay 1', customerName: 'David Sterling', address: '145 King St W, Apt 402', city: 'Kitchener', postalCode: 'N2G 1A7', weightKg: 38.5, dimensionsCm: '140x75x40', cubeVolumeCuFt: 14.8, itemType: 'Furniture', isTwoPersonLift: true, isFragile: false, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 1, driverAssigned: 'Driver #401', status: 'Ready for Van Loading' as any },
    { id: 'bb-k-2', trackingNumber: 'DFLY-KT-849102', routeCode: 'KTCH101', station: 'KTCH', zone: 'KTCH-Z1', stagingBay: 'Bay 1', customerName: 'Apex Tech Labs', address: '280 Victoria St N', city: 'Kitchener', postalCode: 'N2H 5E3', weightKg: 44.0, dimensionsCm: '110x90x80', cubeVolumeCuFt: 28.0, itemType: 'Appliance', isTwoPersonLift: true, isFragile: true, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 2, driverAssigned: 'Driver #401', status: 'Staged' },
    { id: 'bb-k-3', trackingNumber: 'DFLY-KT-849103', routeCode: 'KTCH102', station: 'KTCH', zone: 'KTCH-Z2', stagingBay: 'Bay 3', customerName: 'UW Student Housing', address: '200 University Ave W', city: 'Waterloo', postalCode: 'N2L 3G1', weightKg: 29.0, dimensionsCm: '190x100x25', cubeVolumeCuFt: 16.7, itemType: 'Mattress', isTwoPersonLift: true, isFragile: false, signatureRequired: false, deliveryWindow: 'Afternoon (12:00 - 17:00)', stopSequence: 3, driverAssigned: 'Driver #404', status: 'Staged' },
    { id: 'bb-k-4', trackingNumber: 'DFLY-KT-849104', routeCode: 'KTCH103', station: 'KTCH', zone: 'KTCH-Z3', stagingBay: 'Bay 5', customerName: 'Cambridge Auto Works', address: '550 Hespeler Rd', city: 'Cambridge', postalCode: 'N1R 6J2', weightKg: 52.0, dimensionsCm: '75x75x110', cubeVolumeCuFt: 21.8, itemType: 'Tires', isTwoPersonLift: true, isFragile: false, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 1, driverAssigned: 'Driver #408', status: 'Staged' },
    { id: 'bb-k-5', trackingNumber: 'DFLY-KT-849105', routeCode: 'KTCH104', station: 'KTCH', zone: 'KTCH-Z4', stagingBay: 'Bay 7', customerName: 'Guelph Garden Supply', address: '120 Woodlawn Rd W', city: 'Guelph', postalCode: 'N1H 1B2', weightKg: 34.0, dimensionsCm: '100x60x50', cubeVolumeCuFt: 10.6, itemType: 'Oversize Box', isTwoPersonLift: false, isFragile: false, signatureRequired: false, deliveryWindow: 'Afternoon (12:00 - 17:00)', stopSequence: 4, driverAssigned: 'Driver #412', status: 'Staged' },
    { id: 'bb-k-6', trackingNumber: 'DFLY-KT-849106', routeCode: 'KTCH1200', station: 'KTCH', zone: 'KTCH-Z1', stagingBay: 'Bay 2', customerName: 'Mapleview Medical', address: '42 Weber St E', city: 'Kitchener', postalCode: 'N2H 1C3', weightKg: 46.5, dimensionsCm: '130x85x60', cubeVolumeCuFt: 23.4, itemType: 'Bulk Pallet', isTwoPersonLift: true, isFragile: true, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 1, driverAssigned: 'Driver #415', status: 'Ready for Van Loading' as any },
  ],
  LNDN: [
    { id: 'bb-l-1', trackingNumber: 'DFLY-LN-910201', routeCode: 'LNDN101', station: 'LNDN', zone: 'LNDN-Z1', stagingBay: 'Bay 1', customerName: 'Masonville Orthodontics', address: '1680 Richmond St N', city: 'London', postalCode: 'N6G 3Y9', weightKg: 36.0, dimensionsCm: '120x80x50', cubeVolumeCuFt: 17.0, itemType: 'Furniture', isTwoPersonLift: true, isFragile: true, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 1, driverAssigned: 'Driver #501', status: 'Ready for Van Loading' as any },
    { id: 'bb-l-2', trackingNumber: 'DFLY-LN-910202', routeCode: 'LNDN101', station: 'LNDN', zone: 'LNDN-Z1', stagingBay: 'Bay 1', customerName: 'Sunningdale Golf Club', address: '465 Sunningdale Rd W', city: 'London', postalCode: 'N6G 5B9', weightKg: 48.0, dimensionsCm: '100x100x80', cubeVolumeCuFt: 28.3, itemType: 'Appliance', isTwoPersonLift: true, isFragile: false, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 2, driverAssigned: 'Driver #501', status: 'Staged' },
    { id: 'bb-l-3', trackingNumber: 'DFLY-LN-910203', routeCode: 'LNDN102', station: 'LNDN', zone: 'LNDN-Z2', stagingBay: 'Bay 3', customerName: 'Victoria Hospital Suites', address: '800 Commissioners Rd E', city: 'London', postalCode: 'N6A 5W9', weightKg: 31.5, dimensionsCm: '195x105x30', cubeVolumeCuFt: 21.6, itemType: 'Mattress', isTwoPersonLift: true, isFragile: false, signatureRequired: true, deliveryWindow: 'Afternoon (12:00 - 17:00)', stopSequence: 1, driverAssigned: 'Driver #505', status: 'Staged' },
    { id: 'bb-l-4', trackingNumber: 'DFLY-LN-910204', routeCode: 'LNDN103', station: 'LNDN', zone: 'LNDN-Z3', stagingBay: 'Bay 5', customerName: 'London Airport Logistics', address: '1750 Crumlin Rd', city: 'London', postalCode: 'N5V 3B6', weightKg: 58.0, dimensionsCm: '80x80x120', cubeVolumeCuFt: 27.1, itemType: 'Bulk Pallet', isTwoPersonLift: true, isFragile: false, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 1, driverAssigned: 'Driver #509', status: 'Staged' },
    { id: 'bb-l-5', trackingNumber: 'DFLY-LN-910205', routeCode: 'LNDN104', station: 'LNDN', zone: 'LNDN-Z4', stagingBay: 'Bay 7', customerName: 'Talbot Auto Parts', address: '420 Talbot St', city: 'St. Thomas', postalCode: 'N5P 1B9', weightKg: 42.0, dimensionsCm: '85x85x95', cubeVolumeCuFt: 24.2, itemType: 'Tires', isTwoPersonLift: true, isFragile: false, signatureRequired: false, deliveryWindow: 'Afternoon (12:00 - 17:00)', stopSequence: 3, driverAssigned: 'Driver #512', status: 'Staged' },
    { id: 'bb-l-6', trackingNumber: 'DFLY-LN-910206', routeCode: 'LNDN1200', station: 'LNDN', zone: 'LNDN-Z2', stagingBay: 'Bay 4', customerName: 'Grand Theatre London', address: '471 Richmond St', city: 'London', postalCode: 'N6A 3E4', weightKg: 49.0, dimensionsCm: '160x90x40', cubeVolumeCuFt: 20.3, itemType: 'Furniture', isTwoPersonLift: true, isFragile: true, signatureRequired: true, deliveryWindow: 'Morning (08:00 - 12:00)', stopSequence: 1, driverAssigned: 'Driver #518', status: 'Ready for Van Loading' as any },
  ]
};

export const BigBoxMapCreator: React.FC<BigBoxMapCreatorProps> = ({
  currentStation,
  onSelectStation,
  operatorProfile,
  onUpdateOperator,
  currentDate,
  onSelectDate,
  onBackToHub
}) => {
  const [items, setItems] = useState<BigBoxItem[]>(SEED_BIG_BOX_ITEMS[currentStation] || []);
  const [selectedBay, setSelectedBay] = useState<string | null>('Bay 1');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyTwoPersonLift, setOnlyTwoPersonLift] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'staging_map' | 'zone_map' | 'item_table'>('staging_map');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Sync sample items when station changes if empty
  React.useEffect(() => {
    setItems(SEED_BIG_BOX_ITEMS[currentStation] || []);
    setSelectedBay('Bay 1');
  }, [currentStation]);

  const zones = useMemo(() => STATION_ZONES[currentStation] || [], [currentStation]);

  // Warehouse bays 1 through 10
  const stagingBays: BigBoxStagingBay[] = useMemo(() => {
    const baysList: BigBoxStagingBay[] = [];
    for (let i = 1; i <= 10; i++) {
      const bayNum = `Bay ${i}`;
      const bayItems = items.filter(it => it.stagingBay === bayNum);
      const zoneIndex = Math.floor((i - 1) / 2);
      const assignedZone = zones[zoneIndex]?.code || `${currentStation}-Z${zoneIndex + 1}`;
      const routesAssigned: string[] = Array.from(new Set(bayItems.map(b => b.routeCode)));
      
      let status: 'Available' | 'Staging' | 'Ready for Van Loading' | 'Cleared' = 'Available';
      if (bayItems.length > 0) {
        status = bayItems.every(b => b.status === 'Ready for Van Loading') ? 'Ready for Van Loading' : 'Staging';
      }

      baysList.push({
        id: `bay-${i}`,
        bayNumber: bayNum,
        bayName: `${bayNum} (${assignedZone})`,
        station: currentStation,
        zoneCode: assignedZone,
        capacityBoxes: 15,
        currentBoxes: bayItems.length,
        routesAssigned,
        status
      });
    }
    return baysList;
  }, [items, currentStation, zones]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (selectedBay && it.stagingBay !== selectedBay && viewMode === 'staging_map') return false;
      if (selectedZone && it.zone !== selectedZone) return false;
      if (selectedItemType !== 'all' && it.itemType !== selectedItemType) return false;
      if (onlyTwoPersonLift && !it.isTwoPersonLift) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          it.trackingNumber.toLowerCase().includes(q) ||
          it.customerName.toLowerCase().includes(q) ||
          it.address.toLowerCase().includes(q) ||
          it.routeCode.toLowerCase().includes(q) ||
          it.postalCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, selectedBay, selectedZone, selectedItemType, onlyTwoPersonLift, searchQuery, viewMode]);

  // Export Big Box Manifest as Excel
  const handleExportExcel = () => {
    const dataToExport = items.map((it, idx) => ({
      'Stop #': it.stopSequence,
      'Route Code': it.routeCode,
      'Station': it.station,
      'Zone': it.zone,
      'Staging Bay': it.stagingBay,
      'Tracking Number': it.trackingNumber,
      'Customer Name': it.customerName,
      'Delivery Address': it.address,
      'City': it.city,
      'Postal Code': it.postalCode,
      'Weight (kg)': it.weightKg,
      'Dimensions (cm)': it.dimensionsCm,
      'Cube Volume (cu ft)': it.cubeVolumeCuFt,
      'Package Type': it.itemType,
      '2-Person Lift': it.isTwoPersonLift ? 'YES' : 'NO',
      'Fragile': it.isFragile ? 'YES' : 'NO',
      'Signature Required': it.signatureRequired ? 'YES' : 'NO',
      'Delivery Window': it.deliveryWindow,
      'Assigned Driver': it.driverAssigned || 'Unassigned',
      'Dispatcher / Prepared By': `${operatorProfile.name} (${operatorProfile.designation})`,
      'Date': currentDate
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${currentStation}_BigBox_Manifest`);
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Dragonfly_${currentStation}_BigBox_Staging_Manifest_${currentDate}.xlsx`);
  };

  // Export Printable Warehouse Staging Sheet (PDF)
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const pdfDoc = await PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const page = pdfDoc.addPage([792, 612]); // Landscape 11" x 8.5"
      const { width, height } = page.getSize();

      // Header Banner
      page.drawRectangle({
        x: 20,
        y: height - 55,
        width: width - 40,
        height: 40,
        color: rgb(0.0, 0.65, 0.56)
      });

      page.drawText('DRAGONFLY | INTELCOM - OVERSIZED & BIG BOX WAREHOUSE STAGING MAP', {
        x: 35,
        y: height - 38,
        size: 14,
        font: fontBold,
        color: rgb(1, 1, 1)
      });

      const stationName = currentStation === 'KTCH' ? 'Kitchener Hub (KTCH)' : 'London Hub (LNDN)';
      page.drawText(`Station: ${stationName}   |   Date: ${currentDate}   |   Supervisor: ${operatorProfile.name} (${operatorProfile.designation})`, {
        x: 35,
        y: height - 50,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.9, 1, 0.98)
      });

      // Staging Bay Summary Grid Header
      page.drawText('WAREHOUSE STAGING BAYS ALLOCATION', {
        x: 25,
        y: height - 75,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.2)
      });

      // Draw table columns
      const startY = height - 95;
      const headers = ['Bay', 'Zone Assigned', 'Box Count', 'Weight (kg)', 'Assigned Routes', 'Lift Status', 'Loading Status'];
      const colX = [25, 80, 200, 270, 350, 480, 620];

      page.drawRectangle({
        x: 20,
        y: startY - 14,
        width: width - 40,
        height: 18,
        color: rgb(0.92, 0.94, 0.97)
      });

      headers.forEach((h, i) => {
        page.drawText(h, {
          x: colX[i],
          y: startY - 10,
          size: 8,
          font: fontBold,
          color: rgb(0.2, 0.25, 0.3)
        });
      });

      // Draw Bay Rows
      stagingBays.forEach((bay, bIdx) => {
        const rowY = startY - 30 - (bIdx * 20);
        const bayItems = items.filter(it => it.stagingBay === bay.bayNumber);
        const totalWeight = bayItems.reduce((acc, it) => acc + it.weightKg, 0);
        const hasTwoPerson = bayItems.some(it => it.isTwoPersonLift);

        page.drawText(bay.bayNumber, { x: colX[0], y: rowY, size: 8, font: fontBold, color: rgb(0, 0.45, 0.4) });
        page.drawText(bay.zoneCode, { x: colX[1], y: rowY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`${bayItems.length} Parcels`, { x: colX[2], y: rowY, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`${totalWeight.toFixed(1)} kg`, { x: colX[3], y: rowY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(bay.routesAssigned.join(', ') || 'None', { x: colX[4], y: rowY, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(hasTwoPerson ? '[!] 2-PERSON REQUIRED' : 'Standard', { x: colX[5], y: rowY, size: 8, font: fontBold, color: hasTwoPerson ? rgb(0.8, 0.2, 0.1) : rgb(0.3, 0.5, 0.3) });
        page.drawText(bay.status, { x: colX[6], y: rowY, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

        page.drawLine({
          start: { x: 20, y: rowY - 5 },
          end: { x: width - 20, y: rowY - 5 },
          thickness: 0.5,
          color: rgb(0.88, 0.9, 0.92)
        });
      });

      // Bottom Signatures
      page.drawText(`Generated on: ${new Date().toLocaleString()}   |   Dragonfly Logistics Operations Engine`, {
        x: 25,
        y: 25,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5)
      });

      page.drawText('FLOOR SUPERVISOR SIGN-OFF: __________________________   VAN LOAD CONFIRMED: __________________________', {
        x: 220,
        y: 25,
        size: 8,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.3)
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, `Dragonfly_${currentStation}_BigBox_Warehouse_StagingMap_${currentDate}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Error generating Big Box staging PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full text-slate-100">
      {/* Top Navigation & Global Station Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-gray-400 hover:text-white transition-colors"
            title="Back to Hub Dashboard"
          >
            <ChevronRight className="rotate-180" size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/5">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Big Box Map Creator
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Oversized Logistics
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Warehouse staging bays, delivery zones, heavy-lift allocation & van loading sequence for {currentStation === 'KTCH' ? 'Kitchener' : 'London'}.
            </p>
          </div>
        </div>

        {/* Global Controls: Station, Date, Operator */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => onSelectStation('KTCH')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                currentStation === 'KTCH'
                  ? 'bg-dragonfly-turquoise text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              KTCH (Kitchener)
            </button>
            <button
              type="button"
              onClick={() => onSelectStation('LNDN')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                currentStation === 'LNDN'
                  ? 'bg-dragonfly-lightblue text-slate-950 shadow-sm font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              LNDN (London)
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Calendar size={14} className="text-dragonfly-turquoise" />
            <input
              type="date"
              value={currentDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer"
            />
          </div>

          {/* Export Actions */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dragonfly-turquoise/15 border border-dragonfly-turquoise/30 text-dragonfly-turquoise hover:bg-dragonfly-turquoise/25 text-xs font-bold transition-colors"
          >
            <Printer size={14} />
            {isExportingPdf ? 'Exporting PDF...' : 'Print Staging Map'}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold transition-colors"
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Operator Details Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <User size={15} className="text-dragonfly-turquoise" />
            <span className="text-gray-400 font-medium">Logged in Dispatcher:</span>
            <input
              type="text"
              value={operatorProfile.name}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, name: e.target.value })}
              placeholder="Your Full Name"
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-dragonfly-turquoise focus:outline-none w-44 font-semibold"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Designation:</span>
            <select
              value={operatorProfile.designation}
              onChange={(e) => onUpdateOperator({ ...operatorProfile, designation: e.target.value })}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-dragonfly-turquoise focus:outline-none cursor-pointer"
            >
              {DESIGNATION_OPTIONS.map((des) => (
                <option key={des} value={des}>
                  {des}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-gray-400">
          <span>Total Staged: <strong className="text-white">{items.length} Big Boxes</strong></span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>Heavy Lift: <strong className="text-amber-400">{items.filter(i => i.isTwoPersonLift).length} Items (2-Person)</strong></span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>Total Weight: <strong className="text-dragonfly-turquoise">{items.reduce((a, b) => a + b.weightKg, 0).toFixed(0)} kg</strong></span>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('staging_map')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'staging_map'
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-sm'
                : 'text-gray-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Grid size={15} />
            Warehouse Staging Floor (Bays 1-10)
          </button>

          <button
            type="button"
            onClick={() => setViewMode('zone_map')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'zone_map'
                ? 'bg-dragonfly-turquoise/15 border border-dragonfly-turquoise/40 text-dragonfly-turquoise shadow-sm'
                : 'text-gray-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <MapPin size={15} />
            Delivery Zone Cluster Map
          </button>

          <button
            type="button"
            onClick={() => setViewMode('item_table')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'item_table'
                ? 'bg-dragonfly-lightblue/15 border border-dragonfly-lightblue/40 text-dragonfly-lightblue shadow-sm'
                : 'text-gray-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Boxes size={15} />
            Itemized Manifest ({filteredItems.length})
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracking, route, customer..."
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none w-56"
            />
          </div>

          <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 cursor-pointer hover:border-slate-700 select-none">
            <input
              type="checkbox"
              checked={onlyTwoPersonLift}
              onChange={(e) => setOnlyTwoPersonLift(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>2-Person Lift Only</span>
          </label>
        </div>
      </div>

      {/* Main Content Areas */}
      {viewMode === 'staging_map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Interactive Warehouse Staging Bays Layout */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Grid size={18} className="text-amber-400" />
                    Warehouse Floor Plan - Staging Bays (1 to 10)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Click any bay to view staged packages, dimensions, and assign van loading.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-gray-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Pallet Rows: 2 | Total Bays: 10
                </span>
              </div>

              {/* Warehouse Floor Visual Matrix */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                {stagingBays.map((bay) => {
                  const isSelected = selectedBay === bay.bayNumber;
                  const bayItems = items.filter(it => it.stagingBay === bay.bayNumber);
                  const totalKg = bayItems.reduce((acc, it) => acc + it.weightKg, 0);

                  return (
                    <div
                      key={bay.id}
                      onClick={() => setSelectedBay(bay.bayNumber)}
                      className={`relative flex flex-col justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-xs font-black tracking-wider text-amber-400 font-mono">
                          {bay.bayNumber}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          bay.status === 'Ready for Van Loading'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : bayItems.length > 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-gray-400'
                        }`}>
                          {bay.status === 'Ready for Van Loading' ? 'Ready' : bayItems.length > 0 ? 'Staging' : 'Empty'}
                        </span>
                      </div>

                      <div className="space-y-1 mb-3">
                        <div className="text-[11px] font-bold text-gray-300 truncate">
                          {bay.zoneCode}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Routes: {bay.routesAssigned.join(', ') || 'Unassigned'}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                        <span className="text-gray-400 font-medium">
                          {bayItems.length} Boxes
                        </span>
                        <span className="text-dragonfly-turquoise font-mono font-bold">
                          {totalKg.toFixed(0)} kg
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zone Overview Cards */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <Layers size={14} className="text-dragonfly-turquoise" />
                Active Delivery Zones ({zones.length} Zones for {currentStation})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                {zones.map((z) => (
                  <div
                    key={z.id}
                    onClick={() => setSelectedZone(selectedZone === z.code ? null : z.code)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedZone === z.code
                        ? 'bg-dragonfly-turquoise/15 border-dragonfly-turquoise text-white'
                        : 'bg-slate-950 border-slate-800 text-gray-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between mb-1">
                      <span style={{ color: z.color }}>{z.code}</span>
                      <span className="text-[10px] text-gray-400">{z.assignedBay}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">{z.name}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{z.itemCount} Parcels</span>
                      <span>{z.totalWeightKg} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Col: Selected Bay Details Drawer */}
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Staging Bay Details
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {selectedBay || 'Select a Staging Bay'}
                  </h3>
                </div>
                <span className="text-xs bg-slate-800 text-gray-300 px-2 py-1 rounded">
                  {filteredItems.length} items in view
                </span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-gray-500 space-y-2">
                  <Package size={32} className="mx-auto text-gray-600" />
                  <p className="text-xs">No oversized parcels staged in this bay.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                            {item.trackingNumber}
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-dragonfly-turquoise/20 text-dragonfly-turquoise font-sans">
                              {item.routeCode}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-gray-300 mt-0.5">
                            {item.customerName}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {item.address}, {item.city} ({item.postalCode})
                          </div>
                        </div>

                        <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                          {item.weightKg} kg
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="bg-slate-800 text-gray-300 px-2 py-0.5 rounded">
                          {item.itemType}
                        </span>
                        <span className="bg-slate-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                          {item.dimensionsCm} cm
                        </span>
                        {item.isTwoPersonLift && (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                            <ShieldAlert size={10} /> 2-Person Lift
                          </span>
                        )}
                        {item.signatureRequired && (
                          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                            Sign Req
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-dragonfly-lightblue" />
                          {item.deliveryWindow}
                        </span>
                        <span className="font-mono text-gray-300">
                          Stop #{item.stopSequence}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'zone_map' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin size={18} className="text-dragonfly-turquoise" />
                Geographic Delivery Zone & Dispatch Map ({currentStation})
              </h3>
              <p className="text-xs text-gray-400">
                Visual cluster zones for {currentStation === 'KTCH' ? 'Kitchener-Waterloo-Cambridge-Guelph' : 'London-Middlesex-St. Thomas'}.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 font-medium">Filter by Zone:</span>
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  selectedZone === null ? 'bg-dragonfly-turquoise text-white' : 'bg-slate-800 text-gray-300'
                }`}
              >
                All Zones
              </button>
              {zones.map(z => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setSelectedZone(z.code)}
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    selectedZone === z.code ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-gray-300'
                  }`}
                >
                  {z.code}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Visual Map Simulation */}
          <div className="relative w-full h-96 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 800 400">
              {/* Grid Background */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="800" height="400" fill="url(#grid)" />

              {/* Station Hub Center Point */}
              <circle cx="400" cy="200" r="14" fill="#00A68F" fillOpacity="0.2" stroke="#00A68F" strokeWidth="2" />
              <circle cx="400" cy="200" r="5" fill="#00A68F" />
              <text x="400" y="225" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold">
                {currentStation} DEPOT HUB
              </text>

              {/* Zone Clusters and Vectors */}
              {zones.map((zone, idx) => {
                const angle = (idx / zones.length) * 2 * Math.PI - Math.PI / 2;
                const distance = 130 + (idx % 2) * 35;
                const cx = 400 + Math.cos(angle) * distance;
                const cy = 200 + Math.sin(angle) * distance;
                const isSelected = selectedZone === zone.code || selectedZone === null;

                return (
                  <g key={zone.id} opacity={isSelected ? 1 : 0.25} className="transition-all duration-300">
                    {/* Connecting Route Line */}
                    <line
                      x1="400"
                      y1="200"
                      x2={cx}
                      y2={cy}
                      stroke={zone.color}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />

                    {/* Zone Cluster Bubble */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="40"
                      fill={zone.color}
                      fillOpacity="0.12"
                      stroke={zone.color}
                      strokeWidth="1.5"
                    />
                    
                    {/* Stop markers inside cluster */}
                    <circle cx={cx - 15} cy={cy - 10} r="4" fill="#f59e0b" />
                    <circle cx={cx + 10} cy={cy - 12} r="4" fill="#38bdf8" />
                    <circle cx={cx} cy={cy + 14} r="4" fill="#ec4899" />

                    <text x={cx} y={cy - 2} textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold">
                      {zone.code}
                    </text>
                    <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="9">
                      {zone.itemCount} Boxes
                    </text>
                    <text x={cx} y={cy + 52} textAnchor="middle" fill={zone.color} fontSize="9.5" fontWeight="bold">
                      {zone.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-lg text-[10px] text-gray-400 space-y-1">
              <div className="font-bold text-white uppercase">Map Legend</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-dragonfly-turquoise"></span>
                <span>Central Depot Hub</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Oversized Parcel Stop</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'item_table' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Boxes size={18} className="text-dragonfly-lightblue" />
                Itemized Big Box Parcel Manifest ({filteredItems.length} Records)
              </h3>
              <p className="text-xs text-gray-400">
                Detailed package dimensions, weights, customer destinations, and signature mandates.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-gray-400 bg-slate-950/60 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Seq</th>
                  <th className="p-3">Tracking #</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Zone / Bay</th>
                  <th className="p-3">Customer & Address</th>
                  <th className="p-3">Weight & Dim</th>
                  <th className="p-3">Item Type</th>
                  <th className="p-3">Requirements</th>
                  <th className="p-3">Delivery Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-gray-300">
                {filteredItems.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-gray-400">#{it.stopSequence}</td>
                    <td className="p-3 font-mono font-bold text-white">{it.trackingNumber}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-dragonfly-turquoise/15 text-dragonfly-turquoise font-bold">
                        {it.routeCode}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-white">{it.zone}</div>
                      <div className="text-[10px] text-amber-400 font-mono">{it.stagingBay}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{it.customerName}</div>
                      <div className="text-[11px] text-gray-400">{it.address}, {it.city} ({it.postalCode})</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-amber-400">{it.weightKg} kg</div>
                      <div className="text-[10px] text-gray-400 font-mono">{it.dimensionsCm} cm</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-gray-300">
                        {it.itemType}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {it.isTwoPersonLift && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            2-Person
                          </span>
                        )}
                        {it.signatureRequired && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Signature
                          </span>
                        )}
                        {it.isFragile && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400">
                            Fragile
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[11px] text-gray-400">{it.deliveryWindow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BigBoxMapCreator;
