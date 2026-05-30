
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Scan as ScanIcon, Package, CheckCircle2, AlertTriangle, Printer, History, FileText, MapPin, Search, Calendar, ClipboardCheck, LayoutGrid, ArrowLeft } from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { User, Settings, Order, Scan, Report } from '../../types';
import { dataService } from '../../services/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDateTime, generateZPL } from '../../lib/utils';
import { checkForNotifications } from '../../lib/notificationHelper';

import { Language } from '../../App';

interface OperatorViewProps {
  user: User;
  settings: Settings;
  lang: Language;
}

export default function OperatorView({ user, settings, lang }: OperatorViewProps) {
  const [selectedVirtualOrder, setSelectedVirtualOrder] = useState<Order | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [allScans, setAllScans] = useState<Scan[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [manualQty, setManualQty] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [report, setReport] = useState<Report | null>(null);

  const ensureOfPrefix = (of: string | undefined): string => {
    if (!of) return '';
    const val = of.trim().toUpperCase();
    return val.startsWith('PRO-') ? val : `PRO-${val}`;
  };
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  const playSound = (type: 'success' | 'error') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  };

  const t = {
    fr: {
      selectTitle: 'SÉLECTIONNER UN ORDRE DE FABRICATION',
      placeholder: 'RECHERCHER UN OF OU RÉFÉRENCE...',
      noOrders: 'Aucun ordre de fabrication actif pour cette période',
      productInProgress: 'PRODUIT EN COURS',
      orderLabel: 'Ordre N°',
      ofSerial: 'OF (CODE)',
      productIdLabel: 'ID PRODUIT / RÉFÉRENCE',
      nextUnit: 'PROCHAINE UNITÉ À SCANNER',
      statsProduction: 'PROGRÈS PRODUCTION',
      statsUnits: 'Unités',
      finishBtn: "CLÔTURER L'ORDRE",
      backBtn: 'RETOUR AUX ORDRES',
      scanPlaceholder: 'SCANNEZ LE NUMÉRO...',
      successFinish: 'Ordre clôturé et rapport généré avec succès',
      errorFinish: 'Erreur lors de la clôture de l\'ordre',
      limitReached: 'LIMITE ATTEINTE: Quantité maximale atteinte'
    },
    en: {
      selectTitle: 'SELECT MANUFACTURING ORDER',
      placeholder: 'SEARCH OF OR REFERENCE...',
      noOrders: 'No active production orders for this period',
      productInProgress: 'CURRENT PRODUCT',
      orderLabel: 'Order N°',
      ofSerial: 'OF (CODE)',
      productIdLabel: 'PRODUCT ID / REFERENCE',
      nextUnit: 'NEXT UNIT TO SCAN',
      statsProduction: 'PRODUCTION PROGRESS',
      statsUnits: 'Units',
      finishBtn: 'FINISH ORDER',
      backBtn: 'BACK TO ORDERS',
      scanPlaceholder: 'SCAN THE NUMBER...',
      successFinish: 'Order finished and report generated successfully',
      errorFinish: 'Error finishing order',
      limitReached: 'LIMIT REACHED: Maximum quantity reached'
    }
  }[lang];

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const inputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(loadData, 10000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  async function loadData() {
    const [ordersData, scansData, reportsData] = await Promise.all([
      dataService.getOrders(),
      dataService.getScans(),
      dataService.getReports()
    ]);
    setAllOrders(ordersData);
    setOrders(ordersData.filter(o => o.status !== 'completed' && o.status !== 'deleted' && o.quantityToProduce > 0 && o.scanRequired === true).sort((a, b) => b.createdAt - a.createdAt));
    setAllScans(scansData);
    setReports(reportsData);
    
    // Check for newly loaded scans/completions and show notifications
    checkForNotifications(ordersData, scansData);
    
    // Refresh current scans if an order is selected
    if (selectedVirtualOrder) {
      const orderScans = scansData.filter(s => s.orderId === selectedVirtualOrder.id);
      setScans(orderScans);
    }
  }

  useEffect(() => {
    if (selectedVirtualOrder && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedVirtualOrder]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchStr = searchQuery.toLowerCase();
      const matchesSearch = 
        (order.of || '').toLowerCase().includes(searchStr) || 
        (order.refProduct || '').toLowerCase().includes(searchStr);
      
      return matchesSearch;
    });
  }, [orders, searchQuery]);

  const allowedSNs = useMemo(() => {
    if (!selectedOrder || !settings) return [];
    
    const snRangeStart = Number(settings.snRangeStart) || 0;
    const snRangeEnd = Number(settings.snRangeEnd) || 0;

    // Use all non-deleted orders that require scanning to define fixed blocks/ranges
    const validOrders = allOrders
      .filter(o => o.status !== 'deleted' && o.quantityToProduce > 0 && o.scanRequired === true)
      .sort((a, b) => a.createdAt - b.createdAt);

    const ourIndex = validOrders.findIndex(o => o.id === selectedOrder.id);
    if (ourIndex === -1) return [];

    let offset = 0;
    for (let i = 0; i < ourIndex; i++) {
      offset += validOrders[i].quantityToProduce;
    }

    const startVal = (selectedOrder.snStart !== undefined) ? selectedOrder.snStart : (snRangeStart + offset);
    const endBound = (selectedOrder.snEnd !== undefined) ? selectedOrder.snEnd : (snRangeEnd);
    const qty = selectedOrder.quantityToProduce;
    
    const result: number[] = [];
    for (let i = 0; i < qty; i++) {
      const val = startVal + i;
      if (val <= endBound) {
        result.push(val);
      }
    }
    return result;
  }, [selectedOrder, allOrders, settings]);

  const handleSelectOrder = async (order: Order) => {
    setSelectedVirtualOrder(order as any);
    setSelectedOrder(order);
    
    const existingScans = allScans.filter(s => s.orderId === order.id);
    setScans(existingScans);
    setError(null);
    
    if (order.status === 'pending') {
      const updated = { ...order, status: 'in_progress' as const };
      await dataService.updateOrder(updated);
      setSelectedOrder(updated);
    }
  };

  const finishSegment = async (qty: number) => {
    if (!selectedOrder || !selectedVirtualOrder) return;
    
    // Calculate serial numbers being used for this segment
    let reportScans: string[] = [];
    if (selectedOrder.scanRequired) {
      reportScans = scans.map(s => s.serialNumber);
    }

    // Auto-generate report/label for this segment
    const reportData: Report = {
      id: Date.now().toString(),
      orderId: selectedOrder.id,
      orderOf: selectedVirtualOrder.of,
      refProduct: selectedOrder.refProduct,
      qtyRequested: selectedVirtualOrder.quantityToProduce,
      qtyScanned: qty,
      startTime: selectedOrder.createdAt,
      endTime: Date.now(),
      operatorName: user.name,
      destination: 'Zone Expédition',
      lotNumber: selectedOrder.lotNumber || `LOT-${selectedOrder.of}`,
      scans: reportScans
    };

    try {
      // Save report to database
      await dataService.saveReport(reportData);

      // Check if the entire order is finished
      let finalStatusCheck = false;
      if (selectedOrder.scanRequired) {
        // Re-check all scans from server/local state to be sure
        const freshScans = await dataService.getScans();
        const orderScans = freshScans.filter(s => s.orderId === selectedOrder.id);
        finalStatusCheck = orderScans.length >= selectedOrder.quantityToProduce;
      } else {
        // Manual orders: check if all labels have reports
        const rs = await dataService.getReports();
        const orderReports = rs.filter(r => r.orderId === selectedOrder.id);
        finalStatusCheck = orderReports.length >= (selectedOrder.numberOfLabels || 1);
      }

      if (finalStatusCheck) {
        try {
          await dataService.closeOrder(selectedOrder.id, user.name, 'Zone Expédition');
        } catch (closeErr) {
          console.warn('Silent close error:', closeErr);
          // We continue because the report is already saved and UI can proceed
        }
      }

      setReport(reportData);
      setSelectedVirtualOrder(null);
      setSelectedOrder(null);
      loadData();
    } catch (err: any) {
      setError("Erreur de sauvegarde: " + err.message);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedVirtualOrder || isProcessing || isProcessingRef.current) return;

    if (scans.length >= selectedVirtualOrder.quantityToProduce) {
      setError(t.limitReached);
      setScanInput('');
      return;
    }

    const trimmedScan = scanInput.trim().toUpperCase();
    if (!trimmedScan) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      const numericSN = parseInt(trimmedScan, 10);
      const snRangeStart = Number(settings.snRangeStart);
      const snRangeEnd = Number(settings.snRangeEnd);

      if (isNaN(numericSN)) {
        setError(`S/N INVALIDE: Veuillez scanner un numéro valide`);
        setScanInput('');
        playSound('error');
        setFlash('error');
        setTimeout(() => setFlash(null), 300);
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      if (numericSN < snRangeStart || numericSN > snRangeEnd) {
        setError(`S/N BLOQUÉ: Ce numéro est hors de la plage globale autorisée.`);
        setScanInput('');
        playSound('error');
        setFlash('error');
        setTimeout(() => setFlash(null), 300);
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // Explicit duplicate check first for better UX
      // We check against both allScans from state AND the actual updatedScans list we are maintaining
      if (allScans.some(s => s.serialNumber === trimmedScan)) {
        setError(`DOUBLON: Le numéro ${trimmedScan} a déjà été scanné.`);
        setScanInput('');
        playSound('error');
        setFlash('error');
        setTimeout(() => setFlash(null), 300);
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // Range check for this specific OF
      if (!allowedSNs.includes(numericSN)) {
        setError(`HORS PLAGE OF: Ce numéro n'est pas réservé à cet OF.`);
        setScanInput('');
        playSound('error');
        setFlash('error');
        setTimeout(() => setFlash(null), 300);
        isProcessingRef.current = false;
        setIsProcessing(false);
        return;
      }

      const newScan: Scan = {
        id: Math.random().toString(36).substr(2, 9),
        orderId: selectedOrder.id,
        serialNumber: trimmedScan,
        scannedAt: Date.now(),
        operatorId: user.name,
      };

      await dataService.addScan(newScan);
      
      playSound('success');
      setFlash('success');
      setTimeout(() => setFlash(null), 300);

      const updatedScans = [...scans, newScan];
      setScans(updatedScans);
      setRecentScans(prev => [newScan, ...prev].slice(0, 5));
      setAllScans(prev => [...prev, newScan]);
      setScanInput('');
      setError(null);

      // Check if label/segment is finished
      const numLabels = selectedOrder.numberOfLabels || 1;
      const baseQty = Math.floor(selectedOrder.quantityToProduce / numLabels);
      
      const currentLabelIndex = Math.min(Math.floor((updatedScans.length - 1) / baseQty) + 1, numLabels);
      const segmentStart = (currentLabelIndex - 1) * baseQty;
      const isLastSegment = currentLabelIndex === numLabels;
      const segmentTarget = isLastSegment 
        ? selectedOrder.quantityToProduce - segmentStart
        : baseQty;
      
      const scansInCurrentSegment = updatedScans.length - segmentStart;

      if (scansInCurrentSegment === segmentTarget) {
        const labelMsg = numLabels > 1
          ? `Étiquette ${currentLabelIndex}/${numLabels} créée avec succès`
          : `Étiquette créée avec succès`;
        setMessage({ type: 'success', text: labelMsg });

        // Generate report data for this segment
        const segmentReport: Report = {
          id: Math.random().toString(36).substr(2, 9),
          orderId: selectedOrder.id,
          orderOf: numLabels > 1 ? `${selectedOrder.of} [${currentLabelIndex}/${numLabels}]` : selectedOrder.of,
          refProduct: selectedOrder.refProduct,
          qtyRequested: segmentTarget,
          qtyScanned: segmentTarget,
          startTime: selectedOrder.createdAt,
          endTime: Date.now(),
          operatorName: user.name,
          destination: 'Zone Expédition',
          lotNumber: selectedOrder.lotNumber || `LOT-${selectedOrder.of}`,
          scans: selectedOrder.scanRequired ? updatedScans.slice(segmentStart).map(s => s.serialNumber) : []
        };

        // Keep isProcessing = true during the timeout to prevent duplicate scans/requests
        setTimeout(async () => {
          try {
            await dataService.saveReport(segmentReport);
            
            const isAllDone = updatedScans.length >= selectedOrder.quantityToProduce;
            if (isAllDone) {
              try {
                await dataService.closeOrder(selectedOrder.id, user.name, 'Zone Expédition');
              } catch (closeErr) {
                console.warn('Silent close error:', closeErr);
              }
              setSelectedVirtualOrder(null);
              setSelectedOrder(null);
            }
            
            setReport(segmentReport);
            loadData();
          } catch (err: any) {
            setError("Erreur de sauvegarde: " + err.message);
          } finally {
            isProcessingRef.current = false;
            setIsProcessing(false);
          }
        }, 800); // Reduced delay for better UX and less race condition window
      } else {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    } catch (error) {
      console.error(error);
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  if (report) {
    const isOrderComplete = report.qtyScanned >= report.qtyRequested;

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
            <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-8 bg-[#0066FF] rounded-full" />
              <p className="text-[10px] font-black text-[#0066FF] uppercase tracking-[0.3em] font-sans">GESTION DES ÉTIQUETTES</p>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-[#0F172A]">
              Étiquette de Finalisation
            </h1>
          </div>
          <button 
            type="button"
            onClick={() => setReport(null)}
            className="px-6 py-3 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-[10px] font-black rounded-xl transition-all shadow-sm uppercase tracking-widest shrink-0"
          >
            NOUVEL ORDRE
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Labels Section */}
          <div className="xl:col-span-8 space-y-8 no-print max-h-[85vh] overflow-y-auto pr-4 custom-scrollbar scroll-smooth">
            <div className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden group hover:border-[#0066FF] transition-all flex flex-col md:flex-row items-center gap-10 shadow-sm">
              {/* Unified Industrial Label Template */}
                <div className="label-content w-full max-w-[600px] bg-white border-2 border-black p-6 aspect-[152/102] flex flex-col font-sans shrink-0 text-black leading-tight overflow-hidden relative shadow-md">
                  {/* Header: Logo & Sender */}
                  <div className="flex h-[22%] border-b-2 border-black pb-2 mb-2 items-center gap-6">
                    <div className="w-[35%] border-r-2 border-black flex items-center justify-center p-2 h-full">
                       {settings.logoUrl ? (
                         <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                       ) : (
                         <div className="font-black text-lg italic tracking-tighter uppercase whitespace-nowrap">LOGO</div>
                       )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center overflow-hidden">
                      <span className="text-[10px] font-black uppercase text-slate-500">Expéditeur:</span>
                      <span className="text-[14px] font-black truncate leading-tight">{settings.senderName || (lang === 'fr' ? 'NOM DE LA SOCIÉTÉ' : 'COMPANY NAME')}</span>
                      <span className="text-[10px] truncate leading-none opacity-60">{settings.senderAddress}</span>
                    </div>
                  </div>

                  {/* Recipient & Order split row */}
                  <div className="flex h-[22%] border-b-2 border-black mb-2 pb-2">
                    <div className="w-[60%] border-r-2 border-black flex flex-col justify-center pr-4">
                      <span className="text-[10px] font-black uppercase text-slate-500">Destinataire:</span>
                      <span className="text-[20px] font-black leading-tight truncate uppercase">{report.destination || settings.defaultRecipientName || 'Client'}</span>
                    </div>
                    <div className="flex-1 pl-4 flex flex-col justify-center">
                      <span className="text-[10px] font-black uppercase text-slate-500">N° OF:</span>
                      <span className="text-[20px] font-black leading-tight truncate">{ensureOfPrefix(report.orderOf)}</span>
                    </div>
                  </div>

                  {/* Barcodes section - 2 columns */}
                  <div className="flex-1 flex gap-4 min-h-0">
                    {/* Item Info */}
                    <div className="w-1/2 flex flex-col justify-between border-r-2 border-black/10 pr-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-500">Réf Produit:</span>
                        <span className="text-[24px] font-black truncate leading-none uppercase">{report.refProduct}</span>
                      </div>
                      <div className="bg-white border border-black p-2 flex items-center justify-center h-20">
                        <Barcode value={ensureOfPrefix(report.orderOf)} width={1.8} height={50} fontSize={0} margin={0} />
                      </div>
                    </div>

                    {/* Main Barcode Area */}
                    <div className="flex-1 flex flex-col justify-between">
                       <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-500">Unit Count:</span>
                          <div className="flex items-baseline gap-1 bg-black text-white px-2 py-0.5 rounded text-[12px] font-black">
                             <span>{report.qtyScanned}</span>
                             <span className="opacity-50 text-[10px]">/</span>
                             <span>{report.qtyRequested}</span>
                          </div>
                       </div>
                       <div className="flex-1 flex items-center justify-center border-2 border-black bg-white py-2">
                          <Barcode value={report.refProduct} width={2.2} height={80} fontSize={0} margin={0} />
                       </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-2 flex justify-between text-[10px] font-bold border-t-2 border-black pt-2">
                    <span className="uppercase tracking-widest tracking-tighter italic">Op: {report.operatorName}</span>
                    <span className="font-mono">{new Date(report.endTime).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4 w-full">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col text-center">
                      <span className="text-[9px] font-black text-[#94A3B8] uppercase mb-1">Quantité Totale Scannée</span>
                      <span className="text-3xl font-black text-[#0F172A]">{report.qtyScanned} / {report.qtyRequested} PCS</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const zpl = generateZPL(settings.zebraTemplate, {
                        OF: ensureOfPrefix(report.orderOf),
                        REF: report.refProduct,
                        QTY: report.qtyScanned,
                        QTY_TOTAL: report.qtyRequested,
                        LOT: report.lotNumber,
                        DESTINATION: report.destination || settings.defaultRecipientName || 'Client',
                        RECIPIENT_ADDR: settings.recipientAddress || '',
                        RECIPIENT_CITY: settings.recipientCity || '',
                        SENDER_NAME: settings.senderName || 'Company Name',
                        SENDER_ADDR: settings.senderAddress || '',
                        SENDER_CITY: settings.senderCity || '',
                        DATE: new Date().toLocaleString()
                      });
                      navigator.clipboard.writeText(zpl.trim());
                      setMessage({ type: 'success', text: 'ZPL copié !' });
                    }}
                    className="w-full py-4 bg-slate-50 border border-[#E2E8F0] hover:bg-slate-100 text-slate-600 font-bold rounded-2xl transition-all uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
                  >
                    <FileText size={16} /> COPIER ZPL
                  </button>
                </div>
              </div>
          </div>

          {/* Action & Summary Section */}
          <div className="xl:col-span-4 space-y-8 no-print">
            <div className="bg-slate-900 rounded-[3rem] p-8 md:p-10 shadow-2xl text-white sticky top-8 border border-white/5">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-[#0066FF]/20 rounded-2xl flex items-center justify-center text-[#3B82F6]">
                  <ClipboardCheck size={26} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Récapitulatif Final</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ordre Clôturé</p>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors">Progression OF</span>
                  <span className={cn(
                    "text-2xl font-black tabular-nums",
                    isOrderComplete ? "text-emerald-400" : "text-blue-400"
                  )}>
                    {report.qtyScanned} / {report.qtyRequested}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((report.qtyScanned / report.qtyRequested) * 100, 100)}%` }}
                    className={cn("h-full", isOrderComplete ? "bg-emerald-500" : "bg-blue-500")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    setTimeout(() => window.print(), 200);
                  }}
                  className="w-full flex items-center justify-center gap-4 py-6 bg-[#0066FF] hover:bg-[#0052CC] text-white font-black rounded-[2rem] transition-all shadow-xl shadow-blue-500/30 uppercase tracking-widest cursor-pointer group active:scale-95"
                >
                  <Printer size={20} className="group-hover:-translate-y-0.5 transition-transform" /> 
                  IMPRIMER L'ÉTIQUETTE
                </button>

                <button 
                  type="button"
                  onClick={() => setReport(null)}
                  className="w-full flex items-center justify-center gap-4 py-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-[2rem] transition-all shadow-xl shadow-slate-500/20 uppercase tracking-widest cursor-pointer active:scale-95"
                >
                  <ArrowLeft size={20} />
                  RETOUR
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Printable Section (Industrial Layout) - Hidden on screen */}
        <div className="sr-only pointer-events-none">
            <div id="printable-label" className="border-2 border-black p-10 w-[152mm] h-[102mm] font-sans flex flex-col text-black overflow-hidden relative bg-white">
              {/* Header: Logo & Sender */}
              <div className="flex h-[22%] border-b-2 border-black pb-3 mb-4 items-center gap-10">
                <div className="w-[35%] border-r-2 border-black flex items-center justify-center p-2 h-full">
                   {settings.logoUrl ? (
                     <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                   ) : (
                     <div className="font-black text-4xl italic tracking-tighter uppercase whitespace-nowrap">LOGO</div>
                   )}
                </div>
                <div className="flex-1 flex flex-col justify-center overflow-hidden">
                  <span className="text-[12px] font-black uppercase text-slate-500">Expéditeur:</span>
                  <span className="text-[20px] font-black truncate leading-none">{settings.senderName || (lang === 'fr' ? 'NOM DE LA SOCIÉTÉ' : 'COMPANY NAME')}</span>
                  <span className="text-[12px] truncate mt-1 opacity-60">{settings.senderAddress}, {settings.senderCity}</span>
                </div>
              </div>

              {/* Recipient & Order Info Row */}
              <div className="flex h-[22%] border-b-2 border-black mb-4 pb-4">
                <div className="w-[60%] border-r-2 border-black pr-10 flex flex-col justify-center">
                  <span className="text-[12px] font-black uppercase text-slate-500 mb-1">Destinataire:</span>
                  <div className="text-[28px] font-black leading-none uppercase truncate">{report.destination || settings.defaultRecipientName || 'Client'}</div>
                </div>
                <div className="flex-1 pl-10 flex flex-col justify-center">
                  <span className="text-[12px] font-black uppercase text-slate-500 mb-1">Ordre de Fab (OF):</span>
                  <div className="text-[28px] font-black leading-none truncate">{ensureOfPrefix(report.orderOf)}</div>
                </div>
              </div>

              {/* Barcodes & Main Info Section */}
              <div className="flex-1 flex gap-10 min-h-0">
                {/* OF Barcode Column */}
                <div className="w-[40%] flex flex-col justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black uppercase text-slate-500 mb-1">Réf Produit:</span>
                    <div className="text-[32px] font-black uppercase leading-none truncate">{report.refProduct}</div>
                  </div>
                  <div className="bg-white border-2 border-black p-2 flex items-center justify-center h-16 mt-2">
                    <Barcode value={ensureOfPrefix(report.orderOf)} width={1.8} height={50} fontSize={0} margin={0} />
                  </div>
                </div>

                {/* Main Product Barcode Column */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[12px] font-black uppercase text-slate-500">Unit Count:</span>
                    <div className="flex items-baseline gap-1 bg-black text-white px-3 py-1 rounded-lg text-[20px] font-black">
                       <span>{report.qtyScanned}</span>
                       <span className="opacity-50 text-[14px]">/</span>
                       <span>{report.qtyRequested}</span>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center border-2 border-black bg-white py-2">
                    <Barcode value={report.refProduct} width={2.2} height={80} fontSize={0} margin={0} />
                  </div>
                </div>
              </div>

              {/* Print Footer */}
              <div className="mt-4 flex justify-between text-[12px] font-bold border-t-2 border-black pt-3">
                <span className="uppercase tracking-widest tracking-tighter italic">Op: {report.operatorName}</span>
                <span className="font-mono">{new Date(report.endTime).toLocaleString()}</span>
              </div>
            </div>
        </div>

      </div>
    );
  }

  // Simplified display for numeric strings

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {settings.logoUrl && (
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white border border-slate-100 p-2 rounded-2xl shadow-sm flex items-center justify-center shrink-0">
              <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tight text-[#0F172A]">{lang === 'fr' ? 'Poste de Scan' : 'Scanning Station'}</h1>
        </div>
        
        {flash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[200] pointer-events-none",
              flash === 'success' ? "bg-emerald-500" : "bg-red-500"
            )}
          />
        )}

        {selectedVirtualOrder && (
          <button 
            onClick={() => {
              setSelectedVirtualOrder(null);
              setSelectedOrder(null);
            }}
            className="text-xs text-[#64748B] hover:text-[#0066FF] font-black uppercase tracking-widest flex items-center gap-2 transition-all group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> {t.backBtn}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedVirtualOrder ? (
          <motion.div 
            key="order-selection"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 md:space-y-8"
          >
            <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-[#E2E8F0] shadow-2xl space-y-6 md:space-y-10">
              <div className="flex items-center gap-4 text-[#0066FF]">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Package size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] tracking-tight">{t.selectTitle}</h2>
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mt-1">{lang === 'fr' ? "Choisissez l'OF actif pour démarrer le scan" : "Choose an active order to start scanning"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.2em] ml-2 font-mono">Filtrer par OF/Produit</label>
                   <div className="relative">
                    <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input 
                      type="text"
                      placeholder={t.placeholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl pl-16 pr-6 py-5 text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.2em] ml-2 font-mono">Liste Déroulante</label>
                  <select 
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-6 py-5 text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all appearance-none cursor-pointer"
                    onChange={(e) => {
                      const order = filteredOrders.find(o => o.id === e.target.value);
                      if (order) handleSelectOrder(order);
                    }}
                    value=""
                  >
                    <option value="" disabled>--- Choisir un OF ---</option>
                    {filteredOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        {order.of} | {order.refProduct} ({order.quantityToProduce} pcs)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredOrders.map(order => {
                const orderScansCount = allScans.filter(s => s.orderId === order.id).length;

                const orderReports = reports.filter(r => r.orderId === order.id);
                const isManualFinished = !order.scanRequired && orderReports.length >= (order.numberOfLabels || 1);

                const effectiveCount = order.scanRequired ? orderScansCount : (isManualFinished ? order.quantityToProduce : 0);
                const progress = Math.min(Math.round((effectiveCount / order.quantityToProduce) * 100), 100);
                const isCompleted = progress >= 100;

                return (
                  <button
                    key={order.id}
                    onClick={() => !isCompleted && handleSelectOrder(order)}
                    disabled={isCompleted}
                    className={cn(
                      "bg-white border border-[#E2E8F0] rounded-3xl p-5 text-left hover:border-[#0066FF] hover:shadow-xl transition-all group flex flex-col gap-4 shadow-sm relative overflow-hidden",
                      isCompleted && "opacity-60 grayscale cursor-not-allowed border-emerald-200 bg-emerald-50/10"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-[#94A3B8] group-hover:bg-blue-50 group-hover:text-[#0066FF]"
                      )}>
                        {isCompleted ? <CheckCircle2 size={20} /> : <Package size={20} />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] font-black text-[#0066FF] uppercase tracking-widest">{order.of}</div>
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter",
                            order.scanRequired ? "bg-blue-50 border-blue-100 text-[#0066FF]" : "bg-purple-50 border-purple-100 text-purple-600"
                          )}>
                            {order.scanRequired ? 'SCAN' : 'AUTO'}
                          </span>
                        </div>
                        <div className="text-sm font-black text-[#0F172A] truncate tracking-tight">{order.refProduct}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-bold text-[#94A3B8]">{order.quantityToProduce} unités</span>
                          <span className={cn("text-[10px] font-black", isCompleted ? "text-emerald-600" : "text-blue-600")}>{progress}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={cn("h-full", isCompleted ? "bg-emerald-500" : "bg-blue-500")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="scanning"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto space-y-6 md:space-y-8"
          >
            {/* Header / Info Section with OF Details */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Product Card */}
              <div className="flex-1 bg-white border border-[#E2E8F0] rounded-[2rem] p-8 shadow-sm flex items-center gap-8 justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-[#0066FF] border border-slate-100 flex-shrink-0">
                    <Package size={28} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.3em] mb-1">{t.productInProgress}</div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-[#0F172A]">{selectedOrder.refProduct}</h2>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs font-black text-[#64748B] uppercase tracking-widest">{t.orderLabel} {selectedOrder.of}</span>
                    </div>
                  </div>
              </div>
            </div>
          </div>

          {/* Main Scan Interface */}
            <div className="bg-white border border-[#E2E8F0] rounded-[3rem] p-8 md:p-16 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
              
              {selectedVirtualOrder.scanRequired ? (
                <>
              {/* Product ID Barcode */}
              <div className="mb-8 flex flex-col items-center bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm w-full max-w-sm">
                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.4em] mb-3">{t.productIdLabel}</span>
                <Barcode value={selectedVirtualOrder.refProduct} width={1.5} height={50} fontSize={14} margin={0} />
              </div>

                  <form onSubmit={handleScan} className="w-full max-w-xl">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-8 md:left-10 flex items-center text-[#94A3B8] group-focus-within:text-[#0066FF] transition-colors pointer-events-none">
                        <ScanIcon className="w-10 h-10 md:w-12 md:h-12" />
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        autoFocus
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        placeholder={t.scanPlaceholder}
                        className="w-full bg-[#F8FAFC] border-[3px] md:border-[4px] border-[#E2E8F0] rounded-[2.5rem] md:rounded-[4rem] pl-20 md:pl-28 pr-10 py-8 md:py-14 text-2xl md:text-5xl font-mono font-black tracking-widest focus:outline-none focus:border-[#0066FF] focus:ring-[15px] md:focus:ring-[20px] focus:ring-blue-50 transition-all placeholder:text-[#CBD5E1] text-[#0F172A]"
                      />
                    </div>
                    {/* Notification area */}
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 p-6 bg-red-50 border-2 border-red-100 rounded-[2rem] flex items-center gap-4 text-red-600 text-xs font-black justify-center shadow-lg uppercase tracking-widest"
                      >
                        <AlertTriangle size={20} /> {error}
                      </motion.div>
                    )}
                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] flex items-center gap-4 text-emerald-600 text-xs font-black justify-center shadow-lg uppercase tracking-widest"
                      >
                        <CheckCircle2 size={20} /> {message.text}
                      </motion.div>
                    )}
                  </form>

                  {recentScans.length > 0 && (
                    <div className="mt-12 w-full max-w-xl">
                      <div className="flex items-center gap-2 mb-4 justify-center">
                        <History size={14} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Derniers Scans</span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {recentScans.map((rs, i) => (
                          <motion.div 
                            key={rs.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-900 font-mono shadow-sm"
                          >
                            {rs.serialNumber}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full max-w-xl space-y-8 py-4">
                  <div className="p-8 md:p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center gap-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                      <LayoutGrid size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">MODE PRODUCTION MANUELLE</p>
                      <h3 className="text-2xl font-black text-slate-800">Saisie Finale</h3>
                      <p className="text-xs text-slate-500 mt-2 font-medium">Entrez la quantité totale produite et clôturez l'ordre.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="relative group">
                      <input 
                        type="number"
                        value={manualQty || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val > selectedVirtualOrder.quantityToProduce) {
                             setError(t.limitReached);
                             setManualQty(selectedVirtualOrder.quantityToProduce);
                          } else {
                             setManualQty(val);
                             if (val === selectedVirtualOrder.quantityToProduce) {
                               setTimeout(() => finishSegment(val), 500);
                             }
                          }
                        }}
                        placeholder="QUANTITÉ TOTALE..."
                        className="w-full bg-[#F8FAFC] border-[3px] border-[#E2E8F0] rounded-[2.5rem] px-10 py-8 text-3xl font-black text-center focus:border-blue-500 transition-all outline-none text-slate-900 placeholder:text-slate-200"
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-red-50 border-2 border-red-100 rounded-[2rem] flex items-center gap-4 text-red-600 text-xs font-black justify-center shadow-lg uppercase tracking-widest"
                    >
                      <AlertTriangle size={20} /> {error}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Stats & Progress */}
              <div className="mt-12 md:mt-16 w-full max-w-xl space-y-6">
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex flex-col text-left">
                       <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.3em] mb-1">{t.statsProduction}</span>
                       <span className="text-3xl font-black text-[#0F172A] italic">{scans.length} / {selectedVirtualOrder.quantityToProduce} <span className="text-sm not-italic opacity-50 uppercase ml-1">{t.statsUnits}</span></span>
                     </div>
                     <div className="text-4xl font-black text-[#0F172A] tracking-tighter">
                       {Math.round((scans.length / selectedVirtualOrder.quantityToProduce) * 100)}%
                     </div>
                  </div>
                  <div className="h-4 bg-white rounded-full p-1 border border-slate-200">
                    <motion.div 
                      className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${(scans.length / selectedVirtualOrder.quantityToProduce) * 100}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => {
                        if (window.confirm("Voulez-vous suspendre cet ordre et retourner à la sélection ?")) {
                            setSelectedVirtualOrder(null);
                            setSelectedOrder(null);
                        }
                    }}
                    className="w-full py-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 font-bold rounded-[2rem] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                  >
                    <ArrowLeft size={16} /> Suspendre la Production
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportItem({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-black text-[#94A3B8] uppercase tracking-[0.2em] mb-2">{label}</div>
      <div className="text-xl font-black flex items-center gap-3 text-[#0F172A] tracking-tight">
        {icon}
        {value}
      </div>
    </div>
  );
}
