
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Settings as SettingsIcon, Search, List, BarChart, Save, AlertCircle, Calendar, Edit2, Check, X, TrendingUp, Trash2, Printer, CheckCircle2, History, MapPin, FileText, Upload, Database } from 'lucide-react';
import { User, Settings, Order, Report, Scan } from '../../types';
import { dataService } from '../../services/dataService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDateTime, generateZPL } from '../../lib/utils';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import KPIDashboard from './KPIDashboard';
import BulkImportModal from './BulkImportModal';
import Barcode from 'react-barcode';
import { checkForNotifications } from '../../lib/notificationHelper';

import { Language } from '../../App';

interface SupervisorViewProps {
  user: User;
  settings: Settings;
  onSettingsUpdate?: (settings: Settings) => void;
  lang: Language;
}

type Tab = 'orders' | 'reports' | 'kpi' | 'unitLabels' | 'traceability';

export default function SupervisorView({ user, settings, onSettingsUpdate, lang }: SupervisorViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const ensureOfPrefix = (of: string | undefined): string => {
    if (!of) return '';
    const val = of.trim().toUpperCase();
    return val.startsWith('PRO-') ? val : `PRO-${val}`;
  };
  const [selectedUnitOfId, setSelectedUnitOfId] = useState<string | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [duplicateOfError, setDuplicateOfError] = useState<string | null>(null);
  const [traceabilityQuery, setTraceabilityQuery] = useState('');
  const [traceabilityResult, setTraceabilityResult] = useState<{ scan: Scan, order?: Order }[]>([]);
  const [newOrder, setNewOrder] = useState({
    of: 'PRO-',
    refProduct: '',
    quantity: 0,
    scanRequired: true,
    lotNumber: `L-${format(new Date(), 'yyyy-MM')}`,
    standardBoxSize: 50,
    numberOfBoxes: 0,
    snStart: undefined as number | undefined,
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (showNewOrderModal) {
      setDuplicateOfError(null);
      setNewOrder({ 
        of: 'PRO-', 
        refProduct: '', 
        quantity: 0, 
        scanRequired: true, 
        lotNumber: `L-${format(new Date(), 'yyyy-MM')}`, 
        standardBoxSize: 50, 
        numberOfBoxes: 0,
        snStart: undefined,
        date: format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [showNewOrderModal, settings]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [labelPage, setLabelPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const LABELS_PER_PAGE = 10;

  // Filtering states
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [appliedDateRange, setAppliedDateRange] = useState({ 
    start: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Column specific filters
  const [orderFilters, setOrderFilters] = useState({
    of: '',
    refProduct: '',
    quantity: '',
    mode: '',
    status: ''
  });

  const [scanFilters, setScanFilters] = useState({
    sn: '',
    of: ''
  });

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDangerous?: boolean } | null>(null);

  const t = {
    fr: {
      title: 'Gestion Production',
      subtitle: 'Vérification et Pilotage des Ordres de Fabrication',
      importCsv: 'IMPORTER CSV',
      successOp: 'Opération Réussie',
      errorSys: 'Erreur Système',
      close: 'FERMER',
      tabOrders: 'Tableau OF',
      tabAnalytics: 'Analytics',
      tabLogs: 'Logs',
      searchPlaceholder: 'Rechercher OF ou Produit...',
      btnValidate: 'VALIDER FILTRE',
      tableOfId: 'OF ID',
      tableRef: 'RÉF PRODUIT',
      tableQty: 'QUANTITÉ',
      tableScanMode: 'MODE SCAN',
      tableStatus: 'STATUT',
      tableDate: 'DATE',
      tableActions: 'ACTIONS',
      noOrders: 'Aucun ordre trouvé pour cette période ou recherche.',
      statusPending: 'Attente',
      statusInProgress: 'Production',
      statusCompleted: 'Clôturé',
      statusDeleted: 'Supprimé',
      modeScan: 'Scan',
      modeAuto: 'Auto',
      btnLabel: 'Étiquette',
      btnGenerate: 'Générer',
      deleteOfTitle: "Supprimer l'OF",
      deleteOfMessage: (of: string) => `Voulez-vous vraiment supprimer l'OF ${of} ? Cette action supprimera également l'historique des scans associés.`,
      deleteScanTitle: 'Supprimer le Scan',
      deleteScanMessage: (sn: string) => `Voulez-vous supprimer le scan du numéro de série ${sn} ?`,
      confirm: 'CONFIRMER',
      cancel: 'ANNULER',
      reportTitle: 'Rapport de Production',
      backToTable: 'RETOUR AU TABLEAU',
      orderClosed: 'Ordre Clôturé',
      refProduct: 'Réf Produit',
      operator: 'Opérateur',
      validatedQty: 'Quantité Validée',
      logisticsDest: 'Destination Logistique',
      startTime: 'Heure Début',
      endTime: 'Heure Fin',
      serialNumbers: 'Numéros de Série Enregistrés',
      zebraPreview: 'Aperçu Étiquette Zebra',
      sender: 'Expéditeur:',
      recipient: 'Destinataire:',
      orderNr: 'Order nr. (OF):',
      lot: 'Lot:',
      totalScanned: 'Total Scanné:',
      itemNr: 'Item nr.:',
      totalOfQty: 'Total OF Qty:',
      trackedBy: 'Suivi par',
      printUnit: 'IMPRIMER UNITÉ (CTRL+P)',
      copyZpl: 'COPIER CODE ZPL',
      zplCopied: 'ZPL copié dans le presse-papier !',
      importSuccess: (count: number) => `${count} OF importés : Prêts pour production`,
      importErrorEmpty: 'Aucune donnée valide trouvée',
      importErrorDup: (list: string) => `ERREUR DOUBLONS: Les OF suivants existent déjà : ${list}`,
      updateSuccess: (of: string) => `OF ${of} mis à jour`,
      deleteSuccess: (of: string) => `OF ${of} supprimé`,
      scanDeleteSuccess: (sn: string) => `Scan ${sn} supprimé`,
      pdfReportTitle: 'RAPPORT DE PRODUCTION',
      pdfGeneratedAt: 'Généré le :',
      pdfPeriod: (start: string, end: string) => `Période : ${start} au ${end}`,
      pdfTableHeader: ['OF ID', 'RÉF PRODUIT', 'QUANTITÉ', 'MODE', 'STATUT', 'DATE'],
      pdfKpiTitle: 'Indicateurs de Performance (KPI)',
      pdfKpiTotalOrders: 'Total OF actifs (période)',
      pdfKpiCompleted: 'OF Clôturés (100% validés)',
      pdfKpiInProgress: 'Unité en Production',
      pdfKpiTarget: 'Total Objectif Unités à Produire',
      pdfKpiProduced: 'Total Unités Produites (Réel)',
      pdfKpiRate: 'Taux de Réalisation Global',
      pdfFooter: 'Document confidentiel - Système de Production',
      pdfSuccess: 'Rapport PDF généré avec succès',
      pdfError: 'Erreur lors de la génération du PDF',
      tabUnitLabels: 'Unit Label',
      selectOf: 'Sélectionner OF',
      allModes: 'Tous les modes',
      ofDetails: 'Détails de l\'OF',
      labelPreview: 'Aperçu des étiquettes (152x102mm)',
      totalQty: 'Total Quantité',
      unitQty: 'Quantité Unitaire',
      tabTraceability: 'Traçabilité',
      traceSearchPlaceholder: 'Rechercher un S/N...',
      traceResults: 'Résultats de traçabilité',
      traceHistory: 'Historique de vie de l\'unité',
      traceOfDetails: 'Détails de l\'OF associé',
      noTraceResults: 'Aucun scan trouvé pour ce numéro de série.',
    },
    en: {
      title: 'Production Management',
      subtitle: 'Verification and Monitoring of Manufacturing Orders',
      importCsv: 'IMPORT CSV',
      successOp: 'Operation Successful',
      errorSys: 'System Error',
      close: 'CLOSE',
      tabOrders: 'MO Board',
      tabAnalytics: 'Analytics',
      tabLogs: 'Logs',
      searchPlaceholder: 'Search MO or Product...',
      btnValidate: 'VALIDATE FILTER',
      tableOfId: 'MO ID',
      tableRef: 'PRODUCT REF',
      tableQty: 'QUANTITY',
      tableScanMode: 'SCAN MODE',
      tableStatus: 'STATUS',
      tableDate: 'DATE',
      tableActions: 'ACTIONS',
      noOrders: 'No orders found for this period or search.',
      statusPending: 'Pending',
      statusInProgress: 'In Progress',
      statusCompleted: 'Closed',
      statusDeleted: 'Deleted',
      modeScan: 'Scan',
      modeAuto: 'Auto',
      btnLabel: 'Label',
      btnGenerate: 'Generate',
      deleteOfTitle: 'Delete MO',
      deleteOfMessage: (of: string) => `Do you really want to delete MO ${of}? This action will also delete associated scan history.`,
      deleteScanTitle: 'Delete Scan',
      deleteScanMessage: (sn: string) => `Do you want to delete the scan for serial number ${sn}?`,
      confirm: 'CONFIRM',
      cancel: 'CANCEL',
      reportTitle: 'Production Report',
      backToTable: 'BACK TO BOARD',
      orderClosed: 'Order Closed',
      refProduct: 'Product Ref',
      operator: 'Operator',
      validatedQty: 'Validated Qty',
      logisticsDest: 'Logistic Destination',
      startTime: 'Start Time',
      endTime: 'End Time',
      serialNumbers: 'Recorded Serial Numbers',
      zebraPreview: 'Zebra Label Preview',
      sender: 'Sender:',
      recipient: 'Recipient:',
      orderNr: 'Order nr. (MO):',
      lot: 'Lot:',
      totalScanned: 'Total Scanned:',
      itemNr: 'Item nr.:',
      totalOfQty: 'Total MO Qty:',
      trackedBy: 'Tracked by',
      printUnit: 'PRINT UNIT (CTRL+P)',
      copyZpl: 'COPY ZPL CODE',
      zplCopied: 'ZPL copied to clipboard!',
      importSuccess: (count: number) => `${count} MO imported: Ready for production`,
      importErrorEmpty: 'No valid data found',
      importErrorDup: (list: string) => `DUPLICATE ERROR: Following MO already exist: ${list}`,
      updateSuccess: (of: string) => `MO ${of} updated`,
      deleteSuccess: (of: string) => `MO ${of} deleted`,
      scanDeleteSuccess: (sn: string) => `Scan ${sn} deleted`,
      pdfReportTitle: 'PRODUCTION REPORT',
      pdfGeneratedAt: 'Generated on:',
      pdfPeriod: (start: string, end: string) => `Period: ${start} to ${end}`,
      pdfTableHeader: ['MO ID', 'PRODUCT REF', 'QUANTITY', 'MODE', 'STATUS', 'DATE'],
      pdfKpiTitle: 'Performance Indicators (KPI)',
      pdfKpiTotalOrders: 'Total active MO (period)',
      pdfKpiCompleted: 'Closed MO (100% validated)',
      pdfKpiInProgress: 'Units in Production',
      pdfKpiTarget: 'Total Production Target',
      pdfKpiProduced: 'Total Produced Units (Real)',
      pdfKpiRate: 'Global Realization Rate',
      pdfFooter: 'Confidential Document - Production System',
      pdfSuccess: 'PDF Report generated successfully',
      pdfError: 'Error generating PDF',
      tabUnitLabels: 'Unit Label',
      selectOf: 'Select MO',
      allModes: 'All modes',
      ofDetails: 'MO Details',
      labelPreview: 'Label Preview (152x102mm)',
      totalQty: 'Total Quantity',
      unitQty: 'Unit Quantity',
      tabTraceability: 'Traceability',
      traceSearchPlaceholder: 'Search for a S/N...',
      traceResults: 'Traceability results',
      traceHistory: 'Unit life history',
      traceOfDetails: 'Associated MO details',
      noTraceResults: 'No scan found for this serial number.',
    }
  }[lang];

  const dateInterval = useMemo(() => {
    const [sY, sM, sD] = appliedDateRange.start.split('-').map(Number);
    const [eY, eM, eD] = appliedDateRange.end.split('-').map(Number);
    return {
      start: startOfDay(new Date(sY, sM-1, sD)),
      end: endOfDay(new Date(eY, eM-1, eD))
    };
  }, [appliedDateRange]);
  
  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      const scanDate = new Date(scan.scannedAt);
      const matchesDate = isWithinInterval(scanDate, dateInterval);

      const matchesSN = !scanFilters.sn || scan.serialNumber.toLowerCase().includes(scanFilters.sn.toLowerCase());
      const orderOf = orders.find(o => o.id === scan.orderId)?.of || '';
      const matchesOF = !scanFilters.of || orderOf.toLowerCase().includes(scanFilters.of.toLowerCase());
      return matchesDate && matchesSN && matchesOF;
    });
  }, [scans, scanFilters, orders, dateInterval]);

  const globalNextSN = useMemo(() => {
    if (!settings) return 0;
    const snRangeStart = Number(settings.snRangeStart) || 0;
    
    // Find the highest SN already allocated by looking at snEnd of all orders (including deleted ones)
    // to prevent reusing SNs if an order is deleted.
    const maxAllocatedSN = orders.reduce((max, o) => {
      return (o.snEnd !== undefined && o.snEnd > max) ? o.snEnd : max;
    }, snRangeStart - 1);
    
    return maxAllocatedSN + 1;
  }, [orders, settings]);

  const ordersWithScansInRange = useMemo(() => {
    const orderIds = new Set(scans.filter(s => {
      try {
        return isWithinInterval(new Date(s.scannedAt), dateInterval);
      } catch (e) { return false; }
    }).map(s => s.orderId));
    return orderIds;
  }, [scans, dateInterval]);

  const dashboardOrders = useMemo(() => {
    const matched = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const isCreatedInRange = isWithinInterval(orderDate, dateInterval);
      
      const isCompletedInRange = order.completedAt ? isWithinInterval(new Date(order.completedAt), dateInterval) : false;
      const hasScansInRange = ordersWithScansInRange.has(order.id);

      const matchesDate = isCreatedInRange || isCompletedInRange || hasScansInRange;

      const matchesSearch = order.of.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            order.refProduct.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!(matchesDate && matchesSearch && order.status !== 'deleted')) return false;

      // Column filters
      if (orderFilters.of && !order.of.toLowerCase().includes(orderFilters.of.toLowerCase())) return false;
      if (orderFilters.refProduct && !order.refProduct.toLowerCase().includes(orderFilters.refProduct.toLowerCase())) return false;
      if (orderFilters.quantity && !order.quantityToProduce.toString().includes(orderFilters.quantity)) return false;
      if (orderFilters.mode && (order.scanRequired ? t.modeScan : t.modeAuto).toLowerCase() !== orderFilters.mode.toLowerCase()) return false;
      
      const statusText = order.status === 'completed' ? t.statusCompleted : order.status === 'in_progress' ? t.statusInProgress : t.statusPending;
      if (orderFilters.status && statusText.toLowerCase() !== orderFilters.status.toLowerCase()) return false;

      return true;
    });

    return matched;
  }, [orders, dateInterval, ordersWithScansInRange, searchQuery, orderFilters, t.modeScan, t.modeAuto, t.statusCompleted, t.statusInProgress, t.statusPending]);

  // Pre-calculate SN ranges for all orders to avoid O(N^2) in render
  const orderSnRanges = useMemo(() => {
    const snRangeStart = Number(settings.snRangeStart) || 0;
    const validOrders = orders
      .filter(o => o.status !== 'deleted' && o.quantityToProduce > 0 && o.scanRequired === true)
      .sort((a, b) => a.createdAt - b.createdAt);

    const ranges: Record<string, { start: number; end: number }> = {};
    let currentOffset = 0;

    validOrders.forEach(o => {
      ranges[o.id] = {
        start: snRangeStart + currentOffset,
        end: snRangeStart + currentOffset + o.quantityToProduce - 1
      };
      currentOffset += o.quantityToProduce;
    });

    return ranges;
  }, [orders, settings]);

  const totalPages = Math.ceil(dashboardOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    return dashboardOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [dashboardOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orderFilters, appliedDateRange]);

  useEffect(() => {
    setLabelPage(1);
  }, [selectedUnitOfId]);

  const selectedOrderSNs = useMemo(() => {
    if (!selectedUnitOfId) return [];
    const order = orders.find(o => o.id === selectedUnitOfId);
    if (!order) return [];

    // Auto mode: No serial numbers as requested
    if (!order.scanRequired) {
      return Array(order.quantityToProduce).fill('');
    }

    const snRangeStart = Number(settings.snRangeStart) || 0;
    const snRangeEnd = Number(settings.snRangeEnd) || 0;
    
    let startVal = snRangeStart;
    
    if (order.snStart !== undefined) {
      startVal = order.snStart;
    } else {
      // Fallback for legacy orders: Calculate global offset
      const scanOrders = orders
        .filter(o => o.status !== 'deleted' && o.scanRequired === true)
        .sort((a, b) => a.createdAt - b.createdAt);

      const ourIndex = scanOrders.findIndex(o => o.id === order.id);
      if (ourIndex === -1) return [];

      let offset = 0;
      for (let i = 0; i < ourIndex; i++) {
        offset += scanOrders[i].quantityToProduce;
      }
      startVal = snRangeStart + offset;
    }

    const result: string[] = [];
    
    for (let i = 0; i < order.quantityToProduce; i++) {
      const val = startVal + i;
      // Strict range check: do not generate if outside [start, end]
      if (val >= snRangeStart && val <= snRangeEnd) {
        result.push(val.toString());
      }
    }
    
    return result;
  }, [selectedUnitOfId, orders, settings]);

  const paginatedSNs = useMemo(() => {
    return selectedOrderSNs.slice((labelPage - 1) * LABELS_PER_PAGE, labelPage * LABELS_PER_PAGE);
  }, [selectedOrderSNs, labelPage]);
  
  // Filtering states
  const handleApplyDateFilter = () => {
    setAppliedDateRange({ start: startDate, end: endDate });
  };

  useEffect(() => {
    loadData();
    // Real-time sync: Refresh data when window is focused or every 10 seconds
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
    // Filter out zero quantities as requested
    setOrders(ordersData.filter(o => o.quantityToProduce > 0).sort((a, b) => b.createdAt - a.createdAt));
    setScans(scansData);
    setReports(reportsData);
    
    // Check for newly loaded scans/completions and show notifications
    checkForNotifications(ordersData, scansData);
  }

  const kpiOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const isCreatedInRange = isWithinInterval(orderDate, dateInterval);
      const isCompletedInRange = order.completedAt ? isWithinInterval(new Date(order.completedAt), dateInterval) : false;
      const hasScansInRange = ordersWithScansInRange.has(order.id);

      const matchesDate = isCreatedInRange || isCompletedInRange || hasScansInRange;

      const matchesSearch = order.of.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            order.refProduct.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesDate && matchesSearch && order.status !== 'deleted';
    });
  }, [orders, dateInterval, searchQuery, ordersWithScansInRange]);

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.of || !newOrder.refProduct || newOrder.quantity <= 0) {
      setMessage({ type: 'error', text: lang === 'fr' ? 'Veuillez remplir tous les champs requis.' : 'Please fill all required fields.' });
      return;
    }

    // Ensure PRO- prefix
    let ofValue = newOrder.of.trim().toUpperCase();
    if (ofValue && !ofValue.startsWith('PRO-')) {
      ofValue = 'PRO-' + ofValue;
    }

    // Anti-duplicate OF check
    const isDuplicate = orders.some(o => o.of.trim().toUpperCase() === ofValue && o.status !== 'deleted');
    if (isDuplicate) {
      setMessage({ type: 'error', text: lang === 'fr' ? `L'OF ${ofValue} existe déjà.` : `MO ${ofValue} already exists.` });
      return;
    }

    try {
      const [y, m, d] = newOrder.date.split('-').map(Number);
      const createdAtTimestamp = new Date(y, m-1, d).getTime();

      const snStart = newOrder.snStart ?? globalNextSN;
      const order: Order = {
        id: Math.random().toString(36).substr(2, 9),
        of: ofValue,
        refProduct: newOrder.refProduct.trim(),
        quantityToProduce: newOrder.quantity,
        numberOfLabels: 1, // Default
        scanRequired: newOrder.scanRequired,
        status: 'pending',
        createdAt: createdAtTimestamp,
        lotNumber: newOrder.lotNumber.trim(),
        destination: '',
        standardBoxSize: newOrder.standardBoxSize,
        numberOfBoxes: newOrder.numberOfBoxes,
        snStart: newOrder.scanRequired ? snStart : undefined,
        snEnd: newOrder.scanRequired ? snStart + newOrder.quantity - 1 : undefined
      };

      await dataService.addOrder(order);
      setShowNewOrderModal(false);
      setNewOrder({ 
        of: 'PRO-', 
        refProduct: '', 
        quantity: 0, 
        scanRequired: true, 
        lotNumber: `L-${format(new Date(), 'yyyy-MM')}`, 
        standardBoxSize: 50, 
        numberOfBoxes: 0,
        snStart: undefined,
        date: format(new Date(), 'yyyy-MM-dd')
      });
      loadData();
      setMessage({ type: 'success', text: lang === 'fr' ? `OF ${order.of} créé avec succès.` : `MO ${order.of} created successfully.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleTraceabilitySearch = () => {
    const query = traceabilityQuery.trim().toLowerCase();
    
    if (!query) {
      // Show most recent 20 scans if no query
      const results = scans
        .slice()
        .sort((a, b) => (b.scannedAt || 0) - (a.scannedAt || 0))
        .slice(0, 20)
        .map(s => ({
          scan: s,
          order: orders.find(o => o.id === s.orderId)
        }));
      setTraceabilityResult(results);
      return;
    }

    const results = scans
      .filter(s => s.serialNumber && s.serialNumber.toString().toLowerCase().includes(query))
      .map(s => ({
        scan: s,
        order: orders.find(o => o.id === s.orderId)
      }));
    setTraceabilityResult(results);
  };

  useEffect(() => {
    if (activeTab === 'traceability') {
      handleTraceabilitySearch();
    }
  }, [traceabilityQuery, scans, orders, activeTab]);

  const handleBulkImport = async (newOrders: Order[]) => {
    try {
      await dataService.saveOrders(newOrders);
      await loadData();
      setMessage({ 
        type: 'success', 
        text: lang === 'fr' ? `${newOrders.length} ordres importés.` : `${newOrders.length} orders imported.` 
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleUpdateOrder = async (order: Order) => {
    try {
      const updatedOrder = { ...order, quantityToProduce: editQty };
      if (updatedOrder.snStart !== undefined) {
        updatedOrder.snEnd = updatedOrder.snStart + editQty - 1;
      }
      await dataService.updateOrder(updatedOrder);
      setEditingOrderId(null);
      loadData();
      setMessage({ type: 'success', text: t.updateSuccess(order.of) });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteOrder = (orderId: string, ofName: string) => {
    setConfirmModal({
      isOpen: true,
      title: t.deleteOfTitle,
      message: t.deleteOfMessage(ofName),
      isDangerous: true,
      onConfirm: async () => {
        try {
          setConfirmModal(null);
          await dataService.deleteOrder(orderId);
          await loadData();
          setMessage({ type: 'success', text: t.deleteSuccess(ofName) });
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message });
        }
      }
    });
  };

  const handleDeleteScan = (scanId: string, sn: string) => {
    setConfirmModal({
      isOpen: true,
      title: t.deleteScanTitle,
      message: t.deleteScanMessage(sn),
      isDangerous: true,
      onConfirm: async () => {
        try {
          setConfirmModal(null);
          await dataService.deleteScan(scanId);
          await loadData();
          setMessage({ type: 'success', text: t.scanDeleteSuccess(sn) });
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message });
        }
      }
    });
  };

  const exportPDFReport = () => {
    try {
      const doc = new jsPDF();
      const now = new Date();
      const dateString = format(now, 'dd/MM/yyyy HH:mm');

      // Decorative Top Border
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 15, 210, 1, 'F');

      // Title Section
      doc.setFontSize(26);
      doc.setTextColor(15, 23, 42);
      doc.text("RAPPORT D'ACTIVITÉ PROD", 14, 35);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Identifiant unique: TF-${now.getTime()}`, 14, 42);
      doc.text(`${t.pdfGeneratedAt} ${dateString}`, 14, 47);
      doc.text(t.pdfPeriod(format(dateInterval.start, 'dd/MM/yyyy'), format(dateInterval.end, 'dd/MM/yyyy')), 14, 52);

      // --- SECTION 1: PERFORMANCE SUMMARY (KPI) ---
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235);
      doc.text(t.pdfKpiTitle.toUpperCase(), 14, 65);

      const totalOF = kpiOrders.length;
      const completedOF = kpiOrders.filter(o => o.status === 'completed').length;
      const totalQty = kpiOrders.reduce((acc, o) => acc + o.quantityToProduce, 0);
      
      const totalProducedUnits = kpiOrders.reduce((acc, o) => {
        if (o.status === 'completed') {
          return acc + (Number(o.quantityToProduce) || 0);
        }
        return acc + scans.filter(s => s.orderId === o.id).length;
      }, 0);

      const rate = totalQty > 0 ? Math.round((totalProducedUnits / totalQty) * 100) : 0;

      // KPI Boxes logic
      const kpiData = [
        [t.pdfKpiTotalOrders, totalOF.toString(), t.pdfKpiTarget, totalQty.toString()],
        [t.pdfKpiCompleted, completedOF.toString(), t.pdfKpiProduced, totalProducedUnits.toString()],
        [t.pdfKpiRate, `${rate}%`, "", ""]
      ];

      autoTable(doc, {
        startY: 72,
        body: kpiData,
        theme: 'plain',
        styles: { 
          fontSize: 11, 
          cellPadding: 6, 
          fontStyle: 'bold',
          textColor: [15, 23, 42],
        },
        columnStyles: { 
          0: { cellWidth: 50, textColor: [100, 116, 139], fontStyle: 'normal' }, 
          1: { cellWidth: 40, halign: 'left' },
          2: { cellWidth: 50, textColor: [100, 116, 139], fontStyle: 'normal' }, 
          3: { cellWidth: 40, halign: 'left' }
        }
      });

      // --- SECTION 2: ORDER DETAILS ---
      const nextY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235);
      doc.text(t.tabOrders.toUpperCase(), 14, nextY);

      const tableData = kpiOrders.map(o => [
        o.of,
        o.refProduct,
        o.quantityToProduce.toString(),
        o.scanRequired ? "SCAN" : "AUTO",
        o.status.replace('_', ' ').toUpperCase(),
        formatDateTime(o.createdAt).split(' ')[0]
      ]);

      autoTable(doc, {
        startY: nextY + 7,
        head: [['OF #', 'PRODUIT', 'QTÉ', 'MODE', 'STATUT', 'DATE']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { 
          fontSize: 8,
          halign: 'center'
        },
        columnStyles: {
          1: { halign: 'left', cellWidth: 'auto' },
          4: { fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} sur ${pageCount}`, 105, 285, { align: 'center' });
        doc.text(t.pdfFooter, 105, 290, { align: 'center' });
      }

      doc.save(`Rapport_Production_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
      setMessage({ type: 'success', text: t.pdfSuccess });
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      setMessage({ type: 'error', text: t.pdfError });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        if (report || activeTab === 'unitLabels') {
          e.preventDefault();
          window.print();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [report, activeTab]);

  const handleGenerateLabel = async (order: Order) => {
    try {
      const reportData = await dataService.closeOrder(order.id, user.name, 'Expedition Directe');
      // Persist the report in the database so it appears in Logs
      await dataService.saveReport(reportData);
      setReport(reportData);
      loadData();
      setMessage({ type: 'success', text: t.orderClosed + `: ${order.of}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (report) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between no-print">
          <h1 className="text-3xl font-black tracking-tight text-[#0F172A]">{t.reportTitle}</h1>
          <button 
            onClick={() => setReport(null)}
            className="px-6 py-3 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-black rounded-xl transition-all shadow-sm uppercase tracking-widest"
          >
            {t.backToTable}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2 space-y-8 no-print">
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-10 relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 w-48 h-48 bg-[#0066FF] opacity-[0.03] rotate-45 translate-x-24 -translate-y-24" />
               <div className="flex items-center gap-6 mb-10">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">{t.orderClosed}</h2>
                    <p className="text-xs text-[#0066FF] font-black uppercase tracking-[0.2em] mt-1">{report.orderOf}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-y-10 gap-x-16">
                  <ReportItem label={t.refProduct} value={report.refProduct} />
                  <ReportItem label={t.operator} value={report.operatorName} />
                  <ReportItem label={t.validatedQty} value={`${report.qtyScanned} / ${report.qtyRequested}`} />
                  <ReportItem label={t.logisticsDest} value={report.destination} icon={<MapPin size={18} className="text-[#0066FF]"/>} />
                  <ReportItem label={t.startTime} value={new Date(report.startTime).toLocaleTimeString()} />
                  <ReportItem label={t.endTime} value={new Date(report.endTime).toLocaleTimeString()} />
               </div>

               {report.scans.length > 0 && (
                 <div className="mt-12 pt-10 border-t border-[#F1F5F9]">
                    <h3 className="text-[11px] font-black text-[#94A3B8] uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                      <History size={16} /> {t.serialNumbers}
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {report.scans.map((sn, idx) => (
                        <div key={idx} className="text-[10px] font-black font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[#0F172A] text-center shadow-sm">
                          {sn}
                        </div>
                      ))}
                    </div>
                 </div>
               )}
              </div>
              <div className="md:col-span-1 space-y-8 no-print">
                <div className="bg-white border border-[#E2E8F0] rounded-3xl p-8 space-y-8 shadow-2xl">
              <div className="flex items-center gap-3 text-[#0066FF] font-black text-xs tracking-widest uppercase">
                <Printer size={22} /> {t.zebraPreview}
              </div>
              <div className="w-full max-w-[500px] bg-white rounded-xl border border-slate-200 p-6 shadow-inner">
                <div id="printable-label" className="border-2 border-black w-full bg-white p-4 flex flex-col text-black font-sans aspect-[152/102] leading-tight overflow-hidden">
                  {/* Header: Logo & Sender */}
                  <div className="flex h-[20%] border-b-2 border-black pb-1 mb-1">
                    <div className="w-[40%] border-r border-black flex items-center justify-center p-1">
                       {settings.logoUrl ? (
                         <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                       ) : (
                         <div className="font-black text-lg italic tracking-tighter uppercase whitespace-nowrap">LOGO</div>
                       )}
                    </div>
                    <div className="w-[60%] pl-2 flex flex-col justify-center overflow-hidden">
                      <span className="text-[6px] font-black uppercase text-slate-500">{t.sender}</span>
                      <span className="text-[8px] font-black truncate">{settings.senderName || (lang === 'fr' ? 'NOM DE LA SOCIÉTÉ' : 'COMPANY NAME')}</span>
                      <span className="text-[6px] truncate leading-none">{settings.senderAddress}</span>
                      <span className="text-[6px] truncate font-bold text-slate-500 leading-none">{settings.senderCity}</span>
                    </div>
                  </div>

                  {/* Recipient Section */}
                  <div className="flex h-[20%] border-b border-black mb-1 pb-1">
                    <div className="w-[30%] border-r border-black flex flex-col items-center justify-center text-center">
                       <div className="border border-black p-0.5 flex flex-col items-center w-full">
                         <Package size={14} strokeWidth={2.5} />
                         <span className="text-[6px] font-black text-center leading-none mt-0.5 uppercase">Fragile</span>
                       </div>
                    </div>
                    <div className="w-[70%] pl-2 flex flex-col justify-center">
                      <span className="text-[6px] font-black uppercase text-slate-500">{t.recipient}</span>
                      <span className="text-[12px] font-black leading-tight truncate">{report.destination || settings.defaultRecipientName || 'Client'}</span>
                      <span className="text-[10px] font-medium leading-none truncate">{settings.recipientAddress}</span>
                    </div>
                  </div>

                  {/* Order Section */}
                  <div className="flex h-[22%] border-b border-black mb-1 pb-1">
                    <div className="flex-1 flex flex-col pr-2">
                      <span className="text-[6px] font-black uppercase text-slate-400">{t.orderNr}</span>
                      <span className="text-[14px] font-black tracking-tight truncate mb-0.5">{ensureOfPrefix(report.orderOf)}</span>
                      <div className="flex justify-center h-8 overflow-hidden">
                        <Barcode value={ensureOfPrefix(report.orderOf)} width={1.0} height={25} fontSize={0} margin={0} />
                      </div>
                    </div>
                      <div className="w-[40%] pl-2 flex flex-col justify-center border-l border-black">
                        <div>
                          <span className="text-[6px] font-black uppercase text-slate-500">{t.lot}</span>
                          <span className="text-[10px] font-black truncate block leading-none">{report.lotNumber}</span>
                        </div>
                        <div className="mt-1">
                          <span className="text-[6px] font-black uppercase text-slate-500">{t.totalScanned}</span>
                          <span className="text-[12px] font-black block text-blue-600 leading-none pl-[1px] pt-0 pb-[15px]">{report.qtyScanned} PCS</span>
                        </div>
                     </div>
                  </div>

                  {/* Item Section */}
                  <div className="flex-1 flex flex-col pt-0.5">
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex flex-col">
                        <span className="text-[6px] font-black uppercase text-slate-500">{t.itemNr}</span>
                        <span className="text-[12px] font-black truncate leading-none uppercase">{report.refProduct}</span>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[6px] font-black uppercase text-slate-500 tracking-tighter">{t.totalOfQty}</span>
                         <span className="text-[10px] font-black leading-none">{report.qtyRequested} PCS</span>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-white border border-black p-0.5 overflow-hidden">
                       <Barcode value={report.refProduct} width={1.2} height={40} fontSize={0} margin={0} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-1 flex justify-between text-[4px] font-bold border-t border-slate-100 pt-0.5">
                    <span className="italic">{t.trackedBy} {settings.senderName || (lang === 'fr' ? 'NOM DE LA SOCIÉTÉ' : 'COMPANY NAME')}</span>
                    <span>{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4 no-print">
                <button 
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/30 uppercase tracking-widest cursor-pointer group active:scale-95 relative z-[100]"
                >
                  <Printer size={20} className="group-hover:scale-110 transition-transform" /> {t.printUnit}
                </button>
                <button 
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
                    alert(t.zplCopied);
                  }}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                >
                  <FileText size={16} /> {t.copyZpl}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-white border border-slate-100 p-2 rounded-2xl shadow-sm flex items-center justify-center shrink-0">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg" alt="NASA Logo" className="max-h-full max-w-full object-contain opacity-80" />
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#0F172A] uppercase">{t.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] md:text-xs text-[#64748B] font-bold uppercase tracking-[0.2em] italic">{t.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setShowBulkImportModal(true)}
            className="flex items-center justify-center gap-3 px-8 py-3.5 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 text-[10px] md:text-xs font-black rounded-2xl cursor-pointer transition-all shadow-sm shadow-slate-200/30 uppercase tracking-widest active:scale-[0.98]"
          >
            <Database size={18} />
            <span>{lang === 'fr' ? 'DATA' : 'DATA'}</span>
          </button>
          <button 
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center justify-center gap-3 px-8 py-3.5 bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#0052CC] hover:to-[#0044AA] text-white text-[10px] md:text-xs font-black rounded-2xl cursor-pointer transition-all shadow-xl shadow-blue-500/30 uppercase tracking-widest group active:scale-[0.98]"
          >
            <Package size={18} className="group-hover:translate-y-[-2px] transition-transform" />
            <span>{lang === 'fr' ? 'NOUVEL OF' : 'NEW MO'}</span>
          </button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6 bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-[#E2E8F0] shadow-sm">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input 
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl md:rounded-2xl pl-12 pr-6 py-3 md:py-4 text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
          />
        </div>
        <div className="flex items-center gap-2 md:gap-4 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl px-4 md:px-5 py-2 md:py-3 overflow-x-auto">
          <Calendar size={16} className="text-[#0066FF] shrink-0" />
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase tracking-widest focus:outline-none min-w-[100px]"
          />
          <span className="text-[#94A3B8] font-bold">→</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase tracking-widest focus:outline-none min-w-[100px]"
          />
          <button 
            onClick={handleApplyDateFilter}
            className="ml-2 px-4 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-[10px] font-black rounded-lg transition-all shadow-sm uppercase tracking-widest whitespace-nowrap"
          >
            {t.btnValidate}
          </button>
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-4 md:p-6 rounded-2xl md:rounded-3xl flex items-center gap-4 md:gap-5 text-sm font-medium border shadow-xl backdrop-blur-2xl",
            message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
          )}
        >
          <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0", message.type === 'success' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-red-500 text-white shadow-lg shadow-red-200")}>
            {message.type === 'success' ? <Package size={20} /> : <AlertCircle size={20} />}
          </div>
          <div className="flex-1">
             <div className="font-black uppercase tracking-tight text-base md:text-lg">{message.type === 'success' ? t.successOp : t.errorSys}</div>
             <div className="text-[10px] md:text-xs font-bold opacity-80">{message.text}</div>
          </div>
          <button onClick={() => setMessage(null)} className="p-2 md:p-3 hover:bg-black/5 rounded-full transition-colors font-black text-[10px]">{t.close}</button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 md:gap-10 border-b border-[#E2E8F0] px-2 md:px-6 overflow-x-auto scrollbar-hide">
        {[
          { id: 'orders' as const, label: t.tabOrders, icon: <List size={16}/> },
          { id: 'traceability' as const, label: t.tabTraceability, icon: <Search size={16}/> },
          { id: 'kpi' as const, label: t.tabAnalytics, icon: <TrendingUp size={16}/> },
          { id: 'reports' as const, label: t.tabLogs, icon: <BarChart size={16}/> },
          { id: 'unitLabels' as const, label: t.tabUnitLabels, icon: <Printer size={16}/> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 py-4 md:py-5 text-[10px] font-black tracking-[0.2em] uppercase transition-all relative whitespace-nowrap", 
              activeTab === tab.id ? "text-[#0066FF]" : "text-[#94A3B8] hover:text-[#475569]"
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 w-full h-1 bg-[#0066FF] rounded-t-full shadow-lg shadow-blue-200" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'orders' ? (
          <motion.div 
            key="orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-[#E2E8F0] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[10px] font-black text-[#64748B] uppercase tracking-[0.2em] border-b border-[#E2E8F0]">
                      <th className="px-4 md:px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span>{t.tableOfId}</span>
                          <input 
                            type="text"
                            placeholder="Filter..."
                            className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none"
                            value={orderFilters.of}
                            onChange={e => setOrderFilters({...orderFilters, of: e.target.value})}
                          />
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span>{t.tableRef}</span>
                          <input 
                            type="text"
                            placeholder="Filter..."
                            className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none"
                            value={orderFilters.refProduct}
                            onChange={e => setOrderFilters({...orderFilters, refProduct: e.target.value})}
                          />
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5 text-center">
                        <div className="flex flex-col gap-2">
                          <span>{t.tableQty}</span>
                          <input 
                            type="text"
                            placeholder="Filter..."
                            className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none text-center"
                            value={orderFilters.quantity}
                            onChange={e => setOrderFilters({...orderFilters, quantity: e.target.value})}
                          />
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span>{t.tableScanMode}</span>
                          <select 
                            className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none"
                            value={orderFilters.mode}
                            onChange={e => setOrderFilters({...orderFilters, mode: e.target.value})}
                          >
                            <option value="">Tous</option>
                            <option value={t.modeScan}>{t.modeScan}</option>
                            <option value={t.modeAuto}>{t.modeAuto}</option>
                          </select>
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span>{lang === 'fr' ? 'Plage S/N' : 'SN Range'}</span>
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span>{t.tableStatus}</span>
                          <select 
                            className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none"
                            value={orderFilters.status}
                            onChange={e => setOrderFilters({...orderFilters, status: e.target.value})}
                          >
                            <option value="">Tous</option>
                            <option value={t.statusPending}>{t.statusPending}</option>
                            <option value={t.statusInProgress}>{t.statusInProgress}</option>
                            <option value={t.statusCompleted}>{t.statusCompleted}</option>
                          </select>
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5">{t.tableDate}</th>
                      <th className="px-4 md:px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span>{lang === 'fr' ? 'NB BOX' : 'NB BOXES'}</span>
                        </div>
                      </th>
                      <th className="px-4 md:px-8 py-5 text-right">{t.tableActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 md:px-8 py-32 text-center">
                          <div className="flex flex-col items-center max-w-sm mx-auto">
                            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                              <Search size={40} />
                            </div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight mb-2">
                              {orders.length > 0 ? (lang === 'fr' ? 'Données masquées par les filtres' : 'Data hidden by filters') : t.noOrders}
                            </p>
                            <p className="text-xs text-slate-400 font-medium mb-8 leading-relaxed">
                              {orders.length > 0 
                                ? (lang === 'fr' 
                                    ? "Certains ordres existent mais ne correspondent pas à la période ou à la recherche actuelle." 
                                    : "Some orders exist but don't match the current period or search criteria.")
                                : (lang === 'fr'
                                    ? "Aucune donnée de production n'a été enregistrée pour le moment."
                                    : "No production data has been recorded yet.")
                              }
                            </p>
                            {orders.length > 0 && (
                              <button 
                                onClick={() => {
                                  setSearchQuery('');
                                  setOrderFilters({ of: '', refProduct: '', quantity: '', mode: '', status: '' });
                                  setStartDate(format(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
                                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                  setAppliedDateRange({ 
                                    start: format(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                                    end: format(new Date(), 'yyyy-MM-dd')
                                  });
                                }}
                                className="px-8 py-3.5 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all shadow-sm border border-blue-100"
                              >
                                {lang === 'fr' ? 'Réinitialiser & Voir 1 an' : 'Reset & View 1 year'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map(order => {
                        const orderScansCount = scans.filter(s => s.orderId === order.id).length;
                        
                        const orderReports = reports.filter(r => r.orderId === order.id);
                        const isManualFinished = !order.scanRequired && orderReports.length >= (order.numberOfLabels || 1);
                        const isCompleted = order.status === 'completed' || 
                                           (order.scanRequired ? orderScansCount >= order.quantityToProduce : isManualFinished);
                        
                        const snRange = order.snStart !== undefined ? { start: order.snStart, end: order.snEnd ?? 0 } : orderSnRanges[order.id];

                        return (
                        <tr key={order.id} className="hover:bg-[#F8FAFC] transition-colors group">
                          <td className="px-4 md:px-8 py-6 font-mono font-black text-[#0066FF] uppercase">{ensureOfPrefix(order.of)}</td>
                          <td className="px-4 md:px-8 py-6 text-sm font-bold text-[#334155]">{order.refProduct}</td>
                          <td className="px-4 md:px-8 py-6 text-center text-slate-900">
                            {editingOrderId === order.id ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 justify-center">
                                    <span className="text-[10px] font-black text-slate-400 w-8">Qty:</span>
                                    <input 
                                      type="number"
                                      value={editQty}
                                      onChange={(e) => setEditQty(parseInt(e.target.value) || 0)}
                                      className="w-16 md:w-20 px-2 md:px-3 py-2 bg-white border border-[#0066FF] rounded-lg text-sm font-mono font-bold focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1 justify-center text-center">
                                  <button onClick={() => handleUpdateOrder(order)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => setEditingOrderId(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 justify-center">
                                <span className="text-sm font-mono font-bold">{order.quantityToProduce}</span>
                                <button 
                                  onClick={() => {
                                    setEditingOrderId(order.id);
                                    setEditQty(order.quantityToProduce);
                                  }}
                                  className="p-1.5 opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#0066FF] transition-all"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 md:px-8 py-6">
                          <span className={cn(
                            "text-[9px] md:text-[10px] uppercase font-black px-2 md:px-3 py-1.5 rounded-lg border", 
                            order.scanRequired ? "bg-blue-50 border-blue-100 text-[#0066FF]" : "bg-purple-50 border-purple-100 text-purple-600"
                          )}>
                            {order.scanRequired ? t.modeScan : t.modeAuto}
                          </span>
                        </td>
                          <td className="px-4 md:px-8 py-6 font-mono text-[10px] font-bold text-slate-500 text-center">
                            {snRange ? `${snRange.start} → ${snRange.end}` : '-'}
                          </td>
                          <td className="px-4 md:px-8 py-6">
                          <span className={cn(
                            "inline-flex items-center gap-2 text-[9px] md:text-[10px] uppercase font-black px-2 md:px-3 py-1.5 rounded-full border",
                            isCompleted ? "bg-emerald-50 border-emerald-100 text-emerald-600" : order.status === 'in_progress' ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-slate-50 border-slate-100 text-slate-500"
                          )}>
                            <div className={cn("w-1.5 md:w-2 h-1.5 md:h-2 rounded-full", isCompleted ? "bg-emerald-500" : order.status === 'in_progress' ? "bg-amber-500" : "bg-slate-300")} />
                            {isCompleted ? t.statusCompleted : order.status === 'in_progress' ? t.statusInProgress : t.statusPending}
                          </span>
                        </td>
                        <td className="px-4 md:px-8 py-6 text-[10px] md:text-[11px] text-[#94A3B8] font-bold font-mono">
                          <div className="whitespace-nowrap">{formatDateTime(order.createdAt).split(' ')[0]}</div>
                        </td>
                        <td className="px-4 md:px-8 py-6 font-mono text-[10px] font-black text-slate-900 text-center">
                          {order.numberOfBoxes || '-'}
                        </td>
                        <td className="px-4 md:px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2 md:gap-3">
                            {isCompleted || order.status === 'completed' ? (
                              <button 
                                className="px-3 md:px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] md:text-[10px] font-black transition-all uppercase tracking-widest shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                                onClick={() => handleGenerateLabel(order)}
                              >
                                {t.btnLabel}
                              </button>
                            ) : !order.scanRequired ? (
                              <button 
                                className="px-3 md:px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl text-[9px] md:text-[10px] font-black transition-all uppercase tracking-widest shadow-lg shadow-blue-500/20 cursor-pointer active:scale-95"
                                onClick={() => handleGenerateLabel(order)}
                              >
                                {t.btnGenerate}
                              </button>
                            ) : null}
                            <button 
                              onClick={() => handleDeleteOrder(order.id, order.of)}
                              className="p-2 md:p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer active:scale-90"
                              title="Supprimer l'OF"
                            >
                              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-8 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] rounded-b-3xl">
                <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">
                  Affichage de {((currentPage - 1) * ITEMS_PER_PAGE) + 1} à {Math.min(currentPage * ITEMS_PER_PAGE, dashboardOrders.length)} sur {dashboardOrders.length} OF
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all font-black text-[10px]"
                  >
                    PRÉC.
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      
                      if (pageNum <= 0 || pageNum > totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "w-8 h-8 rounded-lg text-[10px] font-black transition-all",
                            currentPage === pageNum 
                              ? "bg-[#0066FF] text-white shadow-lg shadow-blue-200" 
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all font-black text-[10px]"
                  >
                    SUIV.
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        ) : activeTab === 'traceability' ? (
          <motion.div 
            key="traceability"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row items-end gap-6">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-[#64748B] uppercase tracking-[0.2em] ml-1">{t.traceSearchPlaceholder}</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
                      placeholder="Ex: 50021..."
                      value={traceabilityQuery}
                      onChange={(e) => setTraceabilityQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTraceabilitySearch()}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleTraceabilitySearch}
                  className="px-10 py-4 bg-[#0066FF] text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-[#0052CC] transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  {lang === 'fr' ? 'RECHERCHER' : 'SEARCH'}
                </button>
              </div>

              {traceabilityResult.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-[#94A3B8] uppercase tracking-[0.25em] flex items-center gap-2">
                      <History size={16} /> {traceabilityQuery ? (lang === 'fr' ? 'HISTORIQUE S/N' : 'S/N HISTORY') : (lang === 'fr' ? 'SCANS RÉCENTS' : 'RECENT SCANS')}
                    </h4>
                    <div className="relative space-y-8 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                      {traceabilityResult.map((res, idx) => (
                        <div key={res.scan.id} className="relative pl-16">
                          <div className="absolute left-4 top-1 w-4 h-4 bg-blue-500 rounded-full border-4 border-white shadow-sm z-10" />
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-200 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-slate-900">SCAN PRODUCTION</span>
                              <span className="text-[10px] font-bold text-slate-400">{formatDateTime(res.scan.scannedAt)}</span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-500 font-medium">Opérateur: <span className="font-black text-slate-700">{res.scan.operatorId}</span></p>
                              <p className="text-[10px] text-slate-500 font-medium">Poste: <span className="font-black text-slate-700">Station {idx + 1}</span></p>
                              <p className="text-[10px] text-slate-500 font-medium">S/N: <span className="font-black text-blue-600">{res.scan.serialNumber}</span></p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-[#94A3B8] uppercase tracking-[0.25em] flex items-center gap-2">
                      <Package size={16} /> {t.traceOfDetails}
                    </h4>
                    {traceabilityResult[0].order && (
                      <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 space-y-8 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                            <FileText size={24} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{ensureOfPrefix(traceabilityResult[0].order.of)}</div>
                            <div className="text-xl font-black text-slate-900">{traceabilityResult[0].order.refProduct}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                            <div className="text-xs font-black text-slate-700 uppercase">{traceabilityResult[0].order.status}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lot</div>
                            <div className="text-xs font-black text-slate-700">{traceabilityResult[0].order.lotNumber}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date OF</div>
                            <div className="text-xs font-black text-slate-700">{formatDateTime(traceabilityResult[0].order.createdAt).split(' ')[0]}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</div>
                            <div className="text-xs font-black text-slate-700">{traceabilityResult[0].order.destination || '-'}</div>
                          </div>
                        </div>
                        <div className="pt-6 border-t border-slate-100 flex justify-center">
                           <Barcode value={traceabilityResult[0].scan.serialNumber} width={1.5} height={40} fontSize={12} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 italic">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-300">
                    <Search size={40} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-slate-400 uppercase tracking-tighter">
                      {traceabilityQuery ? (lang === 'fr' ? 'AUCUN RÉSULTAT' : 'NO RESULTS FOUND') : (lang === 'fr' ? 'PRÊT POUR LA RECHERCHE' : 'READY TO SEARCH')}
                    </p>
                    <p className="text-xs font-bold text-slate-400 max-w-xs uppercase tracking-widest leading-relaxed">
                      {traceabilityQuery 
                        ? (lang === 'fr' ? `Aucun scan ne correspond au numéro "${traceabilityQuery}"` : `No scan matches the number "${traceabilityQuery}"`)
                        : (lang === 'fr' ? 'Entrez un numéro de série pour tracer son historique complet' : 'Enter a serial number to trace its full history')
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : activeTab === 'kpi' ? (
          <div key="kpi_tab">
            <KPIDashboard orders={kpiOrders} scans={scans} dateRange={dateInterval} settings={settings} onExportPDF={exportPDFReport} lang={lang} />
          </div>
        ) : activeTab === 'reports' ? (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Scan Management Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-[2.5rem] shadow-xl overflow-hidden">
               <div className="p-8 border-b border-[#F1F5F9] flex items-center justify-between gap-6 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#0F172A]">{lang === 'fr' ? 'Correction de Scans' : 'Scan Corrections'}</h3>
                    <p className="text-[10px] text-[#94A3B8] font-black uppercase tracking-widest">{lang === 'fr' ? 'Supprimer des erreurs de scan pour débloquer la séquence' : 'Delete scan errors to unblock sequence'}</p>
                  </div>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                   <thead className="sticky top-0 bg-[#F8FAFC] z-20">
                     <tr className="text-[10px] font-black text-[#64748B] uppercase tracking-widest border-b border-[#E2E8F0]">
                        <th className="px-8 py-5">
                          <div className="flex flex-col gap-2">
                            <span>S/N</span>
                            <input 
                              type="text"
                              placeholder="Filter SN..."
                              className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none"
                              value={scanFilters.sn}
                              onChange={e => setScanFilters({...scanFilters, sn: e.target.value})}
                            />
                          </div>
                        </th>
                        <th className="px-8 py-5">
                          <div className="flex flex-col gap-2">
                            <span>OF</span>
                            <input 
                              type="text"
                              placeholder="Filter OF..."
                              className="w-full p-1 text-[9px] font-bold border border-slate-200 rounded focus:border-[#0066FF] outline-none"
                              value={scanFilters.of}
                              onChange={e => setScanFilters({...scanFilters, of: e.target.value})}
                            />
                          </div>
                        </th>
                        <th className="px-8 py-5">{lang === 'fr' ? 'Date & Heure' : 'Date & Time'}</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredScans.length === 0 ? (
                        <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-bold italic">{lang === 'fr' ? 'Aucun scan enregistré' : 'No scans recorded'}</td></tr>
                      ) : (
                        filteredScans.slice().reverse().slice(0, 50).map(scan => (
                          <tr key={scan.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-4 font-mono font-black text-slate-900">{scan.serialNumber}</td>
                            <td className="px-8 py-4 text-xs font-bold text-slate-500">
                              {orders.find(o => o.id === scan.orderId)?.of || (lang === 'fr' ? 'Inconnu' : 'Unknown')}
                            </td>
                            <td className="px-8 py-4 text-[10px] font-bold text-slate-400 font-mono">
                              {formatDateTime(scan.scannedAt)}
                            </td>
                            <td className="px-8 py-4 text-right">
                               <button 
                                onClick={() => handleDeleteScan(scan.id, scan.serialNumber)}
                                className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </td>
                          </tr>
                        ))
                      )}
                   </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'unitLabels' ? (
          <motion.div 
            key="unitLabels"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-[#64748B] uppercase tracking-[0.2em] ml-1">{t.selectOf}</label>
                  <select 
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#0066FF] transition-all"
                    value={selectedUnitOfId || ''}
                    onChange={(e) => setSelectedUnitOfId(e.target.value)}
                  >
                    <option value="">-- {t.selectOf} --</option>
                    {orders.filter(o => o.status !== 'deleted' && o.status !== 'completed').map(o => (
                      <option key={o.id} value={o.id}>
                        {o.of} - {o.refProduct}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-[#64748B] uppercase tracking-[0.2em] ml-1">{t.tableScanMode}</label>
                  <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-500">
                    {selectedUnitOfId ? (orders.find(o => o.id === selectedUnitOfId)?.scanRequired ? t.modeScan : t.modeAuto) : t.allModes}
                  </div>
                </div>
              </div>

              {selectedUnitOfId && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 relative">
                  {orders.find(o => o.id === selectedUnitOfId)?.status === 'completed' && (
                    <div className="absolute inset-x-[-24px] inset-y-[-24px] bg-white/70 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-12 space-y-8 rounded-[3rem] border-4 border-dashed border-slate-200">
                      <div className="w-32 h-32 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-200 animate-bounce">
                        <AlertCircle size={64} />
                      </div>
                      <div className="space-y-4 text-center">
                        <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter shadow-sm">
                          {lang === 'fr' ? 'ORDRE CLOTURÉ' : 'ORDER CLOSED'}
                        </h3>
                        <p className="text-slate-500 font-bold text-lg max-w-sm mx-auto">
                          {lang === 'fr' 
                            ? 'Impression désactivée pour cet ordre car il a été finalisé.' 
                            : 'Printing disabled for this order because it has been finalized.'}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedUnitOfId(null)}
                        className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all shadow-2xl hover:scale-105 active:scale-95"
                      >
                        {lang === 'fr' ? 'RETOUR' : 'BACK'}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#0066FF] text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <Package size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#0F172A] tracking-tight">{orders.find(o => o.id === selectedUnitOfId)?.of}</h3>
                        <p className="text-xs text-[#0066FF] font-black uppercase tracking-widest">{orders.find(o => o.id === selectedUnitOfId)?.refProduct}</p>
                      </div>
                    </div>
                    <div className="flex gap-10">
                      <div className="text-right">
                        <div className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">{t.totalQty}</div>
                        <div className="text-2xl font-black text-[#0F172A]">{orders.find(o => o.id === selectedUnitOfId)?.quantityToProduce}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-[#94A3B8] uppercase tracking-[0.25em]">{t.labelPreview}</h3>
                      <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black rounded-xl uppercase tracking-widest transition-all shadow-lg active:scale-95 no-print"
                      >
                        <Printer size={14} /> {t.printUnit}
                      </button>
                    </div>

                    <div className="flex flex-col gap-16 items-center w-full no-print-container py-12 overflow-x-auto min-h-screen bg-slate-50/30 rounded-[2rem]">
                      {(() => {
                        const order = orders.find(o => o.id === selectedUnitOfId);
                        if (!order) return null;
                        
                        return paginatedSNs.map((sn, idx) => {
                          const serialNumber = sn;
                          const globalIdx = ((labelPage - 1) * LABELS_PER_PAGE) + idx;
                          
                          return (
                            <div key={globalIdx} className="relative group w-[152mm] no-print-label-wrapper">
                              <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                <button 
                                  onClick={() => window.print()}
                                  className="p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-black transition-all"
                                  title={t.printUnit}
                                >
                                  <Printer size={16} />
                                </button>
                                <button 
                                  onClick={() => {
                                    const zpl = generateZPL(settings.unitZebraTemplate, {
                                      OF: ensureOfPrefix(order.of),
                                      REF: order.refProduct,
                                      SN: serialNumber,
                                      QTY_TOTAL: order.quantityToProduce,
                                      INDEX: globalIdx + 1,
                                      SENDER_NAME: settings.senderName || 'Company Name',
                                      SENDER_ADDR: settings.senderAddress || '',
                                      SENDER_CITY: settings.senderCity || '',
                                      DATE: new Date().toLocaleString()
                                    });
                                    navigator.clipboard.writeText(zpl.trim());
                                    alert(t.zplCopied);
                                  }}
                                  className="p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all"
                                  title={t.copyZpl}
                                >
                                  <FileText size={16} />
                                </button>
                              </div>
                              <div 
                                className="bg-white border-2 border-black p-6 flex flex-col text-black font-sans leading-tight overflow-hidden w-[152mm] h-[102mm] mx-auto shadow-xl print-label-unit transition-transform hover:scale-[1.02]"
                              >
                              {/* Company Header */}
                              <div className="flex h-20 border-b-2 border-black pb-2 mb-4 items-center gap-6">
                                {settings.logoUrl ? (
                                  <img src={settings.logoUrl} alt="Logo" className="h-[70px] w-auto object-contain max-w-[40%]" />
                                ) : (
                                  <div className="w-12 h-12 bg-slate-100 flex items-center justify-center text-slate-300">
                                    <Package size={24} />
                                  </div>
                                )}
                                <div className="flex-1 flex flex-col justify-center overflow-hidden">
                                  <span className="text-[18px] font-black leading-tight truncate uppercase tracking-tight">
                                    {settings.senderName || (lang === 'fr' ? 'NOM DE LA SOCIÉTÉ' : 'COMPANY NAME')}
                                  </span>
                                  <div className="flex flex-col text-[10px] font-bold leading-tight opacity-70">
                                    <span>{settings.senderAddress} {settings.senderCity}</span>
                                    <span>{settings.senderCountry}</span>
                                    {settings.senderPhone && <span className="mt-0.5">Tél: {settings.senderPhone}</span>}
                                  </div>
                                </div>
                              </div>

                              {/* OF & Product Info - Landscape optimization */}
                              <div className="flex-1 flex flex-col justify-between py-2 min-h-0">
                                <div className="flex justify-between items-center border-b border-black/5 pb-1">
                                  <div className="space-y-0">
                                    <span className="text-[10px] font-black uppercase opacity-50 block">Order of (OF):</span>
                                    <span className="text-[28px] font-black leading-none">{ensureOfPrefix(order.of)}</span>
                                  </div>
                                  <div className="bg-white p-1 border border-black/10 h-[40px] flex items-center shrink-0">
                                    {ensureOfPrefix(order.of) ? (
                                      <Barcode value={ensureOfPrefix(order.of)} width={0.8} height={25} displayValue={false} margin={0} />
                                    ) : (
                                      <div className="w-20 h-6 bg-slate-50" />
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-center border-b border-black/5 pb-1">
                                  <div className="space-y-0 flex-1 overflow-hidden mr-4">
                                    <span className="text-[10px] font-black uppercase opacity-50 block">Product Ref:</span>
                                    <span className="text-[24px] font-black leading-none truncate block">{order.refProduct}</span>
                                  </div>
                                  <div className="bg-white p-1 border border-black/10 h-[40px] flex items-center shrink-0">
                                    {order.refProduct ? (
                                      <Barcode value={order.refProduct} width={0.8} height={25} displayValue={false} margin={0} />
                                    ) : (
                                      <div className="w-20 h-6 bg-slate-50" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-auto pt-2 border-t-2 border-black flex items-center justify-between shrink-0">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] font-bold opacity-40 uppercase tracking-widest">{new Date().toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col items-end gap-2 text-right">
                                  {serialNumber ? (
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-black uppercase opacity-50 tracking-tighter">Serial Number</span>
                                        <div className="bg-white p-0.5 border border-black h-[30px] flex items-center shrink-0">
                                          <Barcode value={serialNumber} width={0.8} height={20} displayValue={false} margin={0} />
                                        </div>
                                      </div>
                                  ) : null}
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className="text-[12px] font-black uppercase tracking-tighter">Quantité = 01 Pcs</span>
                                      <span className="text-[10px] font-black uppercase opacity-60 tracking-tighter">Quantité Totale OF = {order.quantityToProduce} Pcs</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[9px] font-black uppercase opacity-20 tracking-[0.2em]">Séquence:</span>
                                      <div className="flex items-baseline gap-1 bg-black text-white px-2 py-0.5 rounded-sm">
                                        <span className="text-[12px] font-black">{globalIdx + 1}</span>
                                        <span className="text-[9px] font-black opacity-50">/</span>
                                        <span className="text-[12px] font-black">{order.quantityToProduce}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          );
                        });
                      })()}

                      {/* Label Pagination */}
                      {selectedOrderSNs.length > LABELS_PER_PAGE && (
                        <div className="flex items-center gap-4 mt-8 bg-white p-4 rounded-2xl shadow-xl border border-slate-200 no-print">
                          <button 
                            disabled={labelPage === 1}
                            onClick={() => setLabelPage(p => Math.max(1, p - 1))}
                            className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-all font-bold text-xs"
                          >
                            PRÉC.
                          </button>
                          <div className="flex flex-col items-center px-6">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Label</span>
                            <span className="text-sm font-black text-slate-700">{labelPage} / {Math.ceil(selectedOrderSNs.length / LABELS_PER_PAGE)}</span>
                          </div>
                          <button 
                            disabled={labelPage === Math.ceil(selectedOrderSNs.length / LABELS_PER_PAGE)}
                            onClick={() => setLabelPage(p => p + 1)}
                            className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-all font-bold text-xs"
                          >
                            SUIV.
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : null
      }
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setConfirmModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className={cn("p-8", confirmModal.isDangerous ? "bg-red-50/50" : "bg-blue-50/50")}>
                <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 shadow-lg", confirmModal.isDangerous ? "bg-red-500 text-white shadow-red-200" : "bg-blue-500 text-white shadow-blue-200")}>
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">{confirmModal.title}</h3>
                <p className="text-sm font-bold text-slate-500 leading-relaxed">{confirmModal.message}</p>
              </div>
              
              <div className="p-8 flex items-center gap-4 bg-white">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest transition-all"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={cn(
                    "flex-1 px-6 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                    confirmModal.isDangerous ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  )}
                >
                  {t.confirm}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BulkImportModal 
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onImport={handleBulkImport}
        lang={lang}
        existingOrders={orders}
        globalNextSN={globalNextSN}
      />

      <AnimatePresence>
        {showNewOrderModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowNewOrderModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden"
            >
              <form onSubmit={handleAddOrder}>
                <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                      <Package size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{lang === 'fr' ? 'Nouvel OF' : 'New MO'}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{lang === 'fr' ? 'Remplir les détails de production' : 'Fill production details'}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowNewOrderModal(false)}
                    className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numéro OF (Requis)</label>
                      <input 
                        type="text"
                        required
                        autoFocus
                        value={newOrder.of}
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          setNewOrder({...newOrder, of: val});
                          
                          // Real-time check
                          let ofValue = val.trim();
                          if (ofValue && !ofValue.startsWith('PRO-')) {
                            ofValue = 'PRO-' + ofValue;
                          }
                          const isDuplicate = orders.some(o => o.of.trim().toUpperCase() === ofValue && o.status !== 'deleted');
                          if (isDuplicate && ofValue !== 'PRO-') {
                            setDuplicateOfError(lang === 'fr' ? `L'OF ${ofValue} existe déjà.` : `MO ${ofValue} already exists.`);
                          } else {
                            setDuplicateOfError(null);
                          }
                        }}
                        onBlur={() => {
                          let ofValue = newOrder.of.trim().toUpperCase();
                          if (ofValue && !ofValue.startsWith('PRO-')) {
                            ofValue = 'PRO-' + ofValue;
                          }
                          const isDuplicate = orders.some(o => o.of.trim().toUpperCase() === ofValue && o.status !== 'deleted');
                          if (isDuplicate && ofValue !== 'PRO-') {
                            setNewOrder({...newOrder, of: 'PRO-'});
                            setDuplicateOfError(null);
                          }
                        }}
                        className={cn(
                          "w-full px-5 py-3.5 bg-slate-50 border rounded-2xl text-sm font-black focus:outline-none transition-all uppercase",
                          duplicateOfError ? "border-red-500 bg-red-50 focus:border-red-600" : "border-slate-200 focus:border-blue-500 focus:bg-white"
                        )}
                        placeholder="Ex: OF2024-001"
                      />
                      {duplicateOfError && (
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-tight ml-1 animate-pulse">
                          {duplicateOfError}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Référence Produit (Requis)</label>
                      <input 
                        type="text"
                        required
                        value={newOrder.refProduct}
                        onChange={e => setNewOrder({...newOrder, refProduct: e.target.value.toUpperCase()})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:border-blue-500 focus:bg-white transition-all uppercase"
                        placeholder="Ex: PRD-XXX-YYY"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{lang === 'fr' ? 'Date de l\'OF' : 'MO Date'}</label>
                    <input 
                      type="date"
                      required
                      value={newOrder.date}
                      onChange={e => setNewOrder({...newOrder, date: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité (Requis)</label>
                      <input 
                        type="number"
                        required
                        min="1"
                        value={newOrder.quantity || ''}
                        onChange={e => setNewOrder({...newOrder, quantity: parseInt(e.target.value) || 0})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numéro Lot (Optionnel)</label>
                      <input 
                        type="text"
                        value={newOrder.lotNumber}
                        onChange={e => setNewOrder({...newOrder, lotNumber: e.target.value.toUpperCase()})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:border-blue-500 focus:bg-white transition-all uppercase"
                        placeholder="L-2024..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{lang === 'fr' ? 'Nombre de Box' : 'Number of Boxes'}</label>
                        <input 
                          type="number"
                          min="0"
                          value={newOrder.numberOfBoxes || ''}
                          onChange={e => setNewOrder({...newOrder, numberOfBoxes: parseInt(e.target.value) || 0})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                          placeholder="0"
                        />
                      </div>
                      {newOrder.scanRequired && (
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{lang === 'fr' ? 'Plage S/N Finale' : 'Final SN Range'}</p>
                          <p className="text-sm font-mono font-bold text-blue-700">
                            {newOrder.snStart ?? globalNextSN} → {(newOrder.snStart ?? globalNextSN) + (newOrder.quantity || 1) - 1}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mode de Production</div>
                        <div className="text-sm font-black text-slate-900">{newOrder.scanRequired ? 'Mode Scan (Suivi S/N)' : 'Mode Automatique'}</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setNewOrder({...newOrder, scanRequired: !newOrder.scanRequired})}
                        className={cn(
                          "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none",
                          newOrder.scanRequired ? "bg-blue-600" : "bg-slate-300"
                        )}
                      >
                        <span className={cn(
                          "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
                          newOrder.scanRequired ? "translate-x-7" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed px-2">
                      {newOrder.scanRequired 
                        ? 'Le mode SCAN génère des numéros de série uniques pour chaque unité et nécessite un scan par l’opérateur.' 
                        : 'Le mode AUTOMATIQUE permet de clôturer l’OF globalement sans scan individuel.'}
                    </p>
                  </div>
                </div>

                <div className="p-8 flex items-center gap-4 bg-slate-50 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowNewOrderModal(false)}
                    className="flex-1 px-8 py-4 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200"
                  >
                    {lang === 'fr' ? 'CRÉER L’OF' : 'CREATE MO'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
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
