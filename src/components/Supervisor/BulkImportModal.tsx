
import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle, Save, Database, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Order, Settings } from '../../types';
import { cn } from '../../lib/utils';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (orders: Order[]) => void;
  lang: 'fr' | 'en';
  existingOrders: Order[];
  globalNextSN: number;
}

interface GridRow {
  id: string;
  of: string;
  ref: string;
  qty: string;
  lot: string;
  mode: 'SCAN' | 'AUTO';
  error?: string;
  isDuplicate?: boolean;
}

export default function BulkImportModal({ isOpen, onClose, onImport, lang, existingOrders, globalNextSN }: BulkImportModalProps) {
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const t = {
    title: lang === 'fr' ? 'Importation en Masse (Excel)' : 'Bulk Import (Excel)',
    process: lang === 'fr' ? 'Analyser les données' : 'Process Data',
    import: lang === 'fr' ? 'Effectuer l\'importation' : 'Complete Import',
    clear: lang === 'fr' ? 'Vider le tableau' : 'Clear Table',
    colOf: lang === 'fr' ? 'OF' : 'MO',
    colRef: lang === 'fr' ? 'Référence' : 'Reference',
    colQty: lang === 'fr' ? 'Qté' : 'Qty',
    colLot: lang === 'fr' ? 'Lot' : 'Lot',
    colMode: lang === 'fr' ? 'Mode' : 'Mode',
    colSN: lang === 'fr' ? 'Plage S/N' : 'S/N Range',
    modeScan: lang === 'fr' ? 'SCAN' : 'SCAN',
    modeAuto: lang === 'fr' ? 'AUTO' : 'AUTO',
    status: lang === 'fr' ? 'État' : 'Status',
    duplicate: lang === 'fr' ? 'Déjà existant' : 'Already exists',
    valid: lang === 'fr' ? 'Prêt' : 'Ready',
    addRow: lang === 'fr' ? 'Ajouter une ligne' : 'Add row',
    pasteHint: lang === 'fr' ? 'Cliquez sur une cellule et collez vos données Excel (Ctrl+V)' : 'Click a cell and paste your Excel data (Ctrl+V)'
  };

  const createEmptyRow = (): GridRow => ({
    id: Math.random().toString(36).substr(2, 9),
    of: '',
    ref: '',
    qty: '',
    lot: `L-${format(new Date(), 'yyyy-MM')}`,
    mode: 'SCAN'
  });

  useEffect(() => {
    if (isOpen) {
      setGridData(Array(15).fill(null).map(() => createEmptyRow()));
    } else {
      setGridData([]);
    }
  }, [isOpen]);

  const validateRows = (rows: GridRow[]) => {
    return rows.map(row => {
      let error = '';
      if (!row.of && !row.ref && !row.qty) return { ...row, error: undefined, isDuplicate: false };

      if (!row.of) error = lang === 'fr' ? 'OF manquant' : 'Missing MO';
      else if (!row.ref) error = lang === 'fr' ? 'Réf manquante' : 'Missing Ref';
      else if (isNaN(parseInt(row.qty)) || parseInt(row.qty) <= 0) error = lang === 'fr' ? 'Qté invalide' : 'Invalid Qty';

      const ofFormatted = row.of.toUpperCase();
      const isDuplicate = existingOrders.some(o => o.of.toUpperCase() === (ofFormatted.startsWith('PRO-') ? ofFormatted : 'PRO-' + ofFormatted) && o.status !== 'deleted') || 
                         rows.filter(r => r.id !== row.id).some(r => r.of.toUpperCase() === row.of.toUpperCase() && row.of !== '');

      return {
        ...row,
        error: error || undefined,
        isDuplicate: !error && isDuplicate ? true : false
      };
    });
  };

  const handleCellChange = (id: string, field: keyof GridRow, value: string) => {
    const newData = gridData.map(row => row.id === id ? { ...row, [field]: value } : row);
    setGridData(validateRows(newData));
  };

  const removeRow = (id: string) => {
    const newData = gridData.filter(row => row.id !== id);
    setGridData(validateRows(newData));
  };

  const handlePaste = (e: React.ClipboardEvent, rowIdx: number, colIdx: number) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text/plain');
    if (!clipboardData) return;

    const rows = clipboardData.trim().split(/\r?\n/);
    const updatedGrid = [...gridData];

    rows.forEach((rowStr, rOffset) => {
      const targetRowIdx = rowIdx + rOffset;
      if (targetRowIdx >= updatedGrid.length) {
        updatedGrid.push(createEmptyRow());
      }

      const columns = rowStr.split('\t');
      columns.forEach((colStr, cOffset) => {
        const targetColIdx = colIdx + cOffset;
        const fieldMap: (keyof GridRow)[] = ['of', 'ref', 'qty', 'lot', 'mode'];
        const field = fieldMap[targetColIdx];
        
        if (field && field !== 'id' && field !== 'error' && field !== 'isDuplicate') {
          if (field === 'mode') {
            const val = colStr.trim().toUpperCase();
            updatedGrid[targetRowIdx][field] = val === 'AUTO' ? 'AUTO' : 'SCAN';
          } else {
            updatedGrid[targetRowIdx][field] = colStr.trim();
          }
        }
      });
    });

    setGridData(validateRows(updatedGrid));
  };

  const handleFinalImport = () => {
    const validRowsToImport = gridData.filter(r => r.of && r.ref && r.qty && !r.error && !r.isDuplicate);
    if (validRowsToImport.length === 0) return;

    // Calculate ranges in reverse order as requested: 
    // "Last import line (SCAN) takes the start range, and the previous line starts where the first stopped."
    const scanRows = validRowsToImport.filter(r => r.mode === 'SCAN');
    const rangesMap = new Map<string, { start: number, end: number }>();
    let currentSN = Number(globalNextSN) || 0;

    // Iterate backwards through scanRows
    for (let i = scanRows.length - 1; i >= 0; i--) {
      const row = scanRows[i];
      const qty = parseInt(row.qty);
      rangesMap.set(row.id, { start: currentSN, end: currentSN + qty - 1 });
      currentSN += qty;
    }

    const finalOrders: Order[] = validRowsToImport.map(p => {
      let of = p.of.toUpperCase();
      if (!of.startsWith('PRO-')) of = 'PRO-' + of;
      
      const qty = parseInt(p.qty);
      const isScanRequired = p.mode === 'SCAN';
      const range = isScanRequired ? rangesMap.get(p.id) : null;
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        of,
        refProduct: p.ref.toUpperCase(),
        quantityToProduce: qty,
        numberOfLabels: 1,
        scanRequired: isScanRequired,
        status: 'pending',
        createdAt: Date.now(),
        lotNumber: p.lot.toUpperCase(),
        destination: '',
        standardBoxSize: 50,
        numberOfBoxes: Math.ceil(qty / 50),
        snStart: range?.start,
        snEnd: range?.end
      };
    });

    onImport(finalOrders);
    onClose();
  };

  const validRowsToProcess = useMemo(() => {
    return gridData.filter(r => r && r.of && r.ref && r.qty && !r.error && !r.isDuplicate);
  }, [gridData]);

  const validCount = validRowsToProcess.length;
  const totalScanQty = useMemo(() => {
    if (!validRowsToProcess.length) return 0;
    return validRowsToProcess
      .filter(r => r.mode === 'SCAN')
      .reduce((sum, r) => {
        const q = parseInt(r.qty);
        return sum + (isNaN(q) ? 0 : q);
      }, 0);
  }, [validRowsToProcess]);

  // Pre-calculate SN ranges for display
  const snRanges = useMemo(() => {
    const ranges = new Map<string, string>();
    if (!validRowsToProcess.length || globalNextSN === undefined) return ranges;

    const scanRows = validRowsToProcess.filter(r => r && r.mode === 'SCAN');
    let currentSN = Number(globalNextSN) || 0;
    
    // Process in reverse: "La dernière ligne d'importation (SCAN) prend la plage de début"
    for (let i = scanRows.length - 1; i >= 0; i--) {
      const row = scanRows[i];
      if (!row) continue;
      const qty = parseInt(row.qty);
      if (!isNaN(qty) && qty > 0) {
        ranges.set(row.id, `${currentSN} → ${currentSN + qty - 1}`);
        currentSN += qty;
      } else {
        ranges.set(row.id, '-');
      }
    }
    
    // Add "-" for AUTO mode as requested
    validRowsToProcess.forEach(r => {
      if (r && r.mode === 'AUTO') {
        ranges.set(r.id, '-');
      }
    });
    
    return ranges;
  }, [validRowsToProcess, globalNextSN]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t.title}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                {t.pasteHint}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4 border-r border-slate-100 w-12 text-center">#</th>
                <th className="px-6 py-4 border-r border-slate-100">{t.colOf}</th>
                <th className="px-6 py-4 border-r border-slate-100">{t.colRef}</th>
                <th className="px-6 py-4 border-r border-slate-100 w-32">{t.colQty}</th>
                <th className="px-6 py-4 border-r border-slate-100">{t.colLot}</th>
                <th className="px-6 py-4 border-r border-slate-100 w-32">{t.colMode}</th>
                <th className="px-6 py-4 border-r border-slate-100 w-44">{t.colSN}</th>
                <th className="px-6 py-4 w-40">{t.status}</th>
                <th className="px-4 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-mono text-xs">
              {gridData.map((row, rIdx) => (
                <tr key={row.id} className={cn(
                  "group transition-colors",
                  row.error ? "bg-red-50/50" : row.isDuplicate ? "bg-amber-50/50" : "hover:bg-slate-50/30"
                )}>
                  <td className="px-4 py-2 text-center text-slate-300 font-bold border-r border-slate-50">{rIdx + 1}</td>
                  <td className="p-0 border-r border-slate-50">
                    <input 
                      className="w-full px-6 py-3 bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all uppercase placeholder:text-slate-200"
                      value={row.of}
                      placeholder="PRO-XXXXX"
                      onChange={(e) => handleCellChange(row.id, 'of', e.target.value)}
                      onPaste={(e) => handlePaste(e, rIdx, 0)}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-50">
                    <input 
                      className="w-full px-6 py-3 bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all uppercase"
                      value={row.ref}
                      onChange={(e) => handleCellChange(row.id, 'ref', e.target.value)}
                      onPaste={(e) => handlePaste(e, rIdx, 1)}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-50">
                    <input 
                      className="w-full px-6 py-3 bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-center"
                      value={row.qty}
                      onChange={(e) => handleCellChange(row.id, 'qty', e.target.value)}
                      onPaste={(e) => handlePaste(e, rIdx, 2)}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-50">
                    <input 
                      className="w-full px-6 py-3 bg-transparent border-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all uppercase text-slate-400"
                      value={row.lot}
                      onChange={(e) => handleCellChange(row.id, 'lot', e.target.value)}
                      onPaste={(e) => handlePaste(e, rIdx, 3)}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-50 relative flex items-center justify-center">
                    <button 
                      onClick={() => handleCellChange(row.id, 'mode', row.mode === 'SCAN' ? 'AUTO' : 'SCAN')}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all",
                        row.mode === 'SCAN' 
                          ? "bg-blue-50 text-blue-600 border border-blue-100" 
                          : "bg-slate-50 text-slate-600 border border-slate-100"
                      )}
                    >
                      {row.mode === 'SCAN' ? t.modeScan : t.modeAuto}
                    </button>
                    <input 
                      className="absolute inset-0 opacity-0 cursor-default pointer-events-none" 
                      onPaste={(e) => handlePaste(e, rIdx, 4)}
                      readOnly
                    />
                  </td>
                  <td className="px-6 py-3 border-r border-slate-50 text-center font-bold text-blue-600">
                    {snRanges.get(row.id) || ''}
                  </td>
                  <td className="px-6 py-3">
                    {row.error ? (
                      <div className="flex items-center gap-1.5 text-red-500 font-bold text-[10px] uppercase">
                        <AlertCircle size={12} />
                        {row.error}
                      </div>
                    ) : row.isDuplicate ? (
                      <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[10px] uppercase">
                        <AlertCircle size={12} />
                        {t.duplicate}
                      </div>
                    ) : (row.of && row.ref && row.qty) ? (
                      <div className="flex items-center gap-1.5 text-green-500 font-bold text-[10px] uppercase">
                        <Check size={12} />
                        {t.valid}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <button 
                      onClick={() => removeRow(row.id)}
                      className="p-2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="p-6 flex justify-center">
            <button 
              onClick={() => setGridData([...gridData, ...Array(10).fill(null).map(() => createEmptyRow())])}
              className="px-6 py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-slate-300 hover:text-slate-600 transition-all"
            >
              + {t.addRow} (10)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
          <button 
            onClick={() => setGridData(Array(15).fill(null).map(() => createEmptyRow()))}
            className="px-6 py-3 text-slate-400 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
          >
            <Trash2 size={16} />
            {t.clear}
          </button>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'fr' ? 'PROCHAINE PLAGE S/N' : 'NEXT SN RANGE'}</p>
              <p className="text-sm font-mono font-bold text-blue-600">
                {totalScanQty > 0 ? (
                  `${globalNextSN} → ${globalNextSN + totalScanQty - 1}`
                ) : (
                  '---'
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'fr' ? 'LIGNES VALIDES' : 'VALID ROWS'}</p>
              <p className="text-xl font-black text-slate-800">{validCount}</p>
            </div>
            <button 
              onClick={handleFinalImport}
              disabled={validCount === 0}
              className="px-10 py-5 bg-blue-600 text-white rounded-3xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-30 flex items-center gap-3 active:scale-95"
            >
              <Save size={20} />
              {t.import}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

