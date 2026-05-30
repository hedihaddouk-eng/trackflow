
import React, { useMemo } from 'react';
import { Order, Scan } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, Legend } from 'recharts';
import { TrendingUp, Package, CheckCircle2, Clock, Activity, Download, Layers } from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

interface KPIDashboardProps {
  orders: Order[];
  scans: Scan[];
  dateRange: { start: Date; end: Date };
  settings: {
    snRangeStart: number;
    snRangeEnd: number;
  };
  onExportPDF: () => void;
  lang: 'fr' | 'en';
}

const COLORS = {
  primary: '#2563eb', // Blue 600
  secondary: '#6366f1', // Indigo 500
  success: '#10b981', // Emerald 500
  warning: '#f59e0b', // Amber 500
  danger: '#ef4444', // Red 500
  info: '#06b6d4', // Cyan 500
  neutral: '#64748b', // Slate 500
  background: '#f8fafc', // Slate 50
};

export default function KPIDashboard({ orders, scans, dateRange, settings, onExportPDF, lang }: KPIDashboardProps) {
  const t = useMemo(() => {
    const translations = {
      fr: {
        analyticsTitle: 'Tableau de Bord KPI',
        analyticsSubtitle: 'Performance industrielle et suivi en temps réel',
        downloadPdf: 'EXPORTER RAPPORT',
        moClosed: 'OF Clôturés',
        successProd: 'Objectif atteint',
        inProduction: 'En Cours',
        activeStations: 'Unités actives',
        moPending: 'OF en File',
        notStarted: 'Planifiés',
        snConsumption: 'Utilisation SN',
        reservedRange: 'Capacité plage',
        globalRealization: 'Efficacité Globale',
        unitsProduced: (current: number, target: number) => `${current} / ${target} pcs produits`,
        indicatorsTitle: 'Volume de Production',
        indicatorsSubtitle: 'Évolution quotidienne du rendement',
        legendMo: 'OF Terminés',
        legendUnits: 'Pièces Scannées',
        unitProduced: 'Production Réelle',
        mixTitle: 'Statut de la File d\'Attente',
        mixSubtitle: 'Répartition par état d\'avancement',
        activeMo: 'Total OF',
        statusCompleted: 'Terminé',
        statusInProgress: 'Production',
        statusPending: 'En Attente',
        trendTitle: 'Flux de Production',
        trendSubtitle: 'Activité cumulée sur la période',
        liveFeedTitle: 'Flux en Direct',
        liveFeedSubtitle: 'Dernières activités détectées',
      },
      en: {
        analyticsTitle: 'KPI Dashboard',
        analyticsSubtitle: 'Industrial performance and real-time tracking',
        downloadPdf: 'EXPORT REPORT',
        moClosed: 'MO Closed',
        successProd: 'Goal achieved',
        inProduction: 'In Progress',
        activeStations: 'Active units',
        moPending: 'Queue MO',
        notStarted: 'Scheduled',
        snConsumption: 'SN Usage',
        reservedRange: 'Range capacity',
        globalRealization: 'Global Efficiency',
        unitsProduced: (current: number, target: number) => `${current} / ${target} pcs products`,
        indicatorsTitle: 'Production Volume',
        indicatorsSubtitle: 'Daily yield evolution',
        legendMo: 'MO Completed',
        legendUnits: 'Scanned Units',
        unitProduced: 'Actual Production',
        mixTitle: 'Queue Status',
        mixSubtitle: 'Distribution by progress state',
        activeMo: 'Total MO',
        statusCompleted: 'Completed',
        statusInProgress: 'Production',
        statusPending: 'Waiting',
        trendTitle: 'Production Flow',
        trendSubtitle: 'Cumulative activity over period',
        liveFeedTitle: 'Flux en Direct',
        liveFeedSubtitle: 'Dernières activités détectées',
      }
    };
    return translations[lang as 'fr' | 'en'] || translations.fr;
  }, [lang]);

  const stats = useMemo(() => {
    const chartLocale = lang === 'fr' ? fr : undefined;
    const activeOrders = orders.filter(o => o.status !== 'deleted' && o.quantityToProduce > 0);
    const totalActiveOrders = activeOrders.length;
    const completedOrders = activeOrders.filter(o => o.status === 'completed').length;
    const pendingOrders = activeOrders.filter(o => o.status === 'pending').length;
    const inProgressOrders = activeOrders.filter(o => o.status === 'in_progress').length;
    
    const activeOrderIds = new Set(activeOrders.map(o => o.id));
    
    // Total production of tracked orders (scans + auto-completions)
    let totalProducedInPeriod = 0;
    const dailyProduction: Record<string, number> = {};
    const relevantScannedItems: Scan[] = [];

    // Initialize daily production
    const days: string[] = [];
    let curr = new Date(dateRange.start);
    while (curr <= dateRange.end) {
      const d = format(curr, 'yyyy-MM-dd');
      days.push(d);
      dailyProduction[d] = 0;
      curr.setDate(curr.getDate() + 1);
      if (days.length > 366) break;
    }

    // 1. Process Scans
    if (Array.isArray(scans)) {
      scans.forEach(s => {
        if (!s || !s.scannedAt || !activeOrderIds.has(s.orderId)) return;
        try {
          const scanDate = new Date(s.scannedAt);
          if (isWithinInterval(scanDate, dateRange)) {
            relevantScannedItems.push(s);
            const day = format(scanDate, 'yyyy-MM-dd');
            if (dailyProduction[day] !== undefined) {
              dailyProduction[day]++;
              totalProducedInPeriod++;
            }
          }
        } catch (e) { /* ignore */ }
      });
    }

    // 2. Process AUTO orders that were completed in period
    activeOrders.forEach(o => {
      if (!o.scanRequired && o.status === 'completed' && o.completedAt) {
        try {
          const compDate = new Date(o.completedAt);
          if (isWithinInterval(compDate, dateRange)) {
            const day = format(compDate, 'yyyy-MM-dd');
            if (dailyProduction[day] !== undefined) {
              const qty = Number(o.quantityToProduce) || 0;
              dailyProduction[day] += qty;
              totalProducedInPeriod += qty;
            }
          }
        } catch (e) { /* ignore */ }
      }
    });
    
    // Total target of all orders involved in this period
    const totalTarget = activeOrders.reduce((acc, o) => acc + (Number(o.quantityToProduce) || 0), 0);
    
    // For completion rate, we use total production of these active orders (including prior scans)
    // to show how far we are on the MOs we worked on in this period
    const totalProductionOfActiveOrders = activeOrders.reduce((acc, o) => {
      if (o.status === 'completed') return acc + (Number(o.quantityToProduce) || 0);
      
      // If it's a SCAN order in progress, count current scans
      if (o.scanRequired) {
        const allOrderScansCount = scans.filter(s => s.orderId === o.id).length;
        return acc + allOrderScansCount;
      }
      
      // If AUTO order and NOT completed, we assume 0 progress until confirmed completed
      return acc;
    }, 0);

    const completionRate = totalTarget > 0 ? Math.round((totalProductionOfActiveOrders / totalTarget) * 100) : 0;

    const snRangeStart = Number(settings.snRangeStart) || 0;
    const snRangeEnd = Number(settings.snRangeEnd) || 0;
    const snRangeTotal = Math.max(0, snRangeEnd - snRangeStart + 1);
    
    // Global SN consumption (unique SNs from all ACTIVE orders)
    const uniqueSnConsumed = new Set<string>();
    if (Array.isArray(scans)) {
      scans.forEach(s => {
        if (!s || !activeOrderIds.has(s.orderId)) return;
        // Try to extract a number from the SN string for range comparison
        const snMatch = s.serialNumber.match(/\d+/);
        const sn = snMatch ? parseInt(snMatch[0], 10) : NaN;
        
        // If it matches numeric range OR if we just want to count it as a scan
        if (!isNaN(sn) && sn >= snRangeStart && sn <= snRangeEnd) {
          uniqueSnConsumed.add(s.serialNumber);
        } else if (isNaN(sn)) {
          // If not a number, still count it if it's within an active order
          uniqueSnConsumed.add(s.serialNumber);
        }
      });
    }
    const globalScansInRange = uniqueSnConsumed.size;
    
    // Period-specific SN consumption (unique SNs in period from active orders)
    const uniquePeriodSn = new Set<string>();
    relevantScannedItems.forEach(s => {
      const snMatch = s.serialNumber.match(/\d+/);
      const sn = snMatch ? parseInt(snMatch[0], 10) : NaN;
      if (!isNaN(sn) && sn >= snRangeStart && sn <= snRangeEnd) {
        uniquePeriodSn.add(s.serialNumber);
      } else if (isNaN(sn)) {
        uniquePeriodSn.add(s.serialNumber);
      }
    });
    const periodScansInRange = uniquePeriodSn.size;

    const snConsumptionRate = snRangeTotal > 0 ? (globalScansInRange / snRangeTotal) * 100 : 0;
    const snConsumptionRateRounded = snConsumptionRate > 0 && snConsumptionRate < 1 ? snConsumptionRate.toFixed(1) : Math.round(snConsumptionRate).toString();
    
    const dailyOFData: Record<string, number> = {};
    
    days.forEach(day => { 
      dailyOFData[day] = 0;
    });
    
    activeOrders.forEach(order => {
      if (order.status === 'completed' && order.completedAt) {
        try {
          const day = format(new Date(order.completedAt), 'yyyy-MM-dd');
          if (dailyOFData[day] !== undefined) dailyOFData[day]++;
        } catch (e) {}
      }
    });

    let cumulativeProduction = 0;
    const chartData = days.map(day => {
      const date = new Date(day);
      cumulativeProduction += dailyProduction[day] || 0;
      return {
        name: format(date, 'dd MMM', { locale: chartLocale }),
        of: dailyOFData[day] || 0,
        units: dailyProduction[day] || 0,
        cumulative: cumulativeProduction
      };
    });

    const pieData = [
      { name: t.statusCompleted, value: completedOrders, color: COLORS.success },
      { name: t.statusInProgress, value: inProgressOrders, color: COLORS.warning },
      { name: t.statusPending, value: pendingOrders, color: COLORS.neutral },
    ];

    return {
      totalActiveOrders,
      completedOrders,
      pendingOrders,
      inProgressOrders,
      totalTarget,
      totalScanned: totalProducedInPeriod,
      snRangeTotal,
      scansInRange: globalScansInRange,
      periodScansInRange,
      snConsumptionRate: parseFloat(snConsumptionRateRounded),
      chartData,
      pieData,
      completionRate
    };
  }, [orders, scans, settings, lang, t, dateRange]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <TrendingUp size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{t.analyticsTitle}</h2>
            <p className="text-[10px] font-black text-blue-300 uppercase tracking-[0.3em] mt-1">{t.analyticsSubtitle}</p>
          </div>
        </div>
        <button 
          onClick={onExportPDF}
          className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-white text-slate-900 text-xs font-black rounded-2xl transition-all hover:scale-105 active:scale-95 uppercase tracking-widest shadow-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-slate-100 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Download size={18} className="relative z-10" /> 
          <span className="relative z-10">{t.downloadPdf}</span>
        </button>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard 
          icon={<CheckCircle2 />} 
          label={t.moClosed} 
          value={stats.completedOrders} 
          subValue={t.successProd}
          color="emerald"
        />
        <StatCard 
          icon={<Clock />} 
          label={t.inProduction} 
          value={stats.inProgressOrders} 
          subValue={t.activeStations}
          color="amber"
        />
        <StatCard 
          icon={<Package />} 
          label={t.moPending} 
          value={stats.pendingOrders} 
          subValue={t.notStarted}
          color="slate"
        />
        <StatCard 
          icon={<Activity />} 
          label={t.snConsumption} 
          value={`${stats.scansInRange} / ${stats.snRangeTotal}`} 
          subValue={`${t.reservedRange} (${stats.periodScansInRange} sur période)`}
          progress={stats.snConsumptionRate}
          color="indigo"
        />
        <StatCard 
          icon={<TrendingUp />} 
          label={t.globalRealization} 
          value={`${stats.completionRate}%`} 
          subValue={t.unitsProduced(stats.totalScanned, stats.totalTarget)}
          progress={stats.completionRate}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Production Volume Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{t.indicatorsTitle}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t.indicatorsSubtitle}</p>
            </div>
            <div className="hidden sm:flex gap-6">
              <LegendItem color={COLORS.primary} label={t.legendUnits} />
              <LegendItem color={COLORS.neutral} label={t.legendMo} />
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} barGap={4}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="units" name={t.unitProduced} fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="of" name={t.legendMo} fill={COLORS.neutral} radius={[4, 4, 0, 0]} barSize={12} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Mix (Pie) */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
           <div className="mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{t.mixTitle}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t.mixSubtitle}</p>
          </div>
          <div className="h-[320px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                   {stats.pieData.map((entry, index) => (
                     <linearGradient key={`grad-${index}`} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={entry.color} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={entry.color} stopOpacity={1}/>
                     </linearGradient>
                   ))}
                </defs>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={85}
                  outerRadius={115}
                  paddingAngle={8}
                  dataKey="value"
                  animationBegin={200}
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#color-${index})`} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<SimpleTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">{stats.totalActiveOrders}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.activeMo}</span>
            </div>
          </div>
          <div className="mt-10 space-y-3">
            {stats.pieData.map((item, idx) => (
              <div key={idx} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-tight">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-sm font-black text-slate-900">{item.value}</span>
                   <div className="text-[10px] font-bold text-slate-300">{(item.value / stats.totalActiveOrders * 100 || 0).toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Global Trend Area Chart */}
        <div className="lg:col-span-2 bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between mb-12 relative z-10">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tighter">{t.trendTitle}</h3>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">{t.trendSubtitle}</p>
            </div>
          </div>
          <div className="h-[250px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip dark />} />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke={COLORS.primary} 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorCum)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Scan Feed */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
          <div className="mb-8">
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{t.liveFeedTitle}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t.liveFeedSubtitle}</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {scans.slice().reverse().slice(0, 10).map((scan, idx) => {
              const order = orders.find(o => o.id === scan.orderId);
              return (
                <div key={scan.id} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in slide-in-from-right-4 fade-in duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shrink-0">
                    <Activity size={20} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-black text-[#0066FF] uppercase tracking-widest truncate mr-2">{order?.of || 'OF Inconnu'}</span>
                      <span className="text-[9px] font-bold text-slate-400">{format(new Date(scan.scannedAt), 'HH:mm:ss')}</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 font-mono tracking-tight">{scan.serialNumber}</div>
                  </div>
                </div>
              );
            })}
            {scans.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                <Activity size={48} className="opacity-20 mb-4" />
                <p className="text-xs font-bold italic tracking-widest">EN ATTENTE DE SCANS...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label, dark }: any) {
  if (active && payload && payload.length) {
    return (
      <div className={`${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 border rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${dark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <div className="flex items-baseline gap-2">
                 <span className={`text-xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{entry.value}</span>
                 <span className={`text-[9px] font-bold uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{entry.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function SimpleTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-xl">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
           <span className="text-[10px] font-black text-slate-900 uppercase">{payload[0].name}</span>
           <span className="text-sm font-black text-slate-900">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
}

function StatCard({ icon, label, value, subValue, color, progress }: any) {
  const colorMap: Record<string, string> = {
     emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-100',
     amber: 'bg-amber-500/10 text-amber-600 border-amber-100',
     slate: 'bg-slate-500/10 text-slate-600 border-slate-100',
     indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-100',
     blue: 'bg-blue-500/10 text-blue-600 border-blue-100',
  };

  const barColorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-500',
    indigo: 'bg-indigo-500',
    blue: 'bg-blue-500',
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 group hover:-translate-y-2 transition-all duration-300">
      <div className="flex flex-col gap-6">
        <div className={`w-16 h-16 ${colorMap[color]} rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 duration-500`}>
          {React.cloneElement(icon, { size: 32, strokeWidth: 2.5 })}
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tighter">{value}</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 italic mt-1 leading-none">{subValue}</p>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-8 pt-6 border-t border-slate-50">
          <div className="flex justify-between items-center mb-2">
             <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Progress</span>
             <span className="text-[10px] font-black text-slate-900">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100">
            <div className={`h-full ${barColorMap[color]} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
