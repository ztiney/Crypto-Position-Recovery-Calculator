
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Calculator, Activity, Wallet, RefreshCw, BarChart2, Layers, 
  Plus, Trash2, Search, Loader2, Clock, AlertTriangle, Info, X, CheckSquare, Settings2
} from 'lucide-react';
import { InputGroup } from './components/InputGroup';
import { SimulationTable } from './components/SimulationTable';
import { PositionState, SimulationRow, CoinSearchResult, StrategyType } from './types';

const STORAGE_KEY = 'crypto_recovery_positions_v2';

const DEFAULT_POSITION: PositionState = {
  id: 'initial',
  symbol: 'BTC',
  coinId: 'bitcoin',
  avgPrice: 65000,
  holdings: 0.5,
  currentPrice: 58000,
  availableFunds: 10000,
  dropStep: 5,
  multiplier: 1.5,
  baseBuy: 1000,
  strategyType: 'martingale',
};

const App: React.FC = () => {
  const [positions, setPositions] = useState<PositionState[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [DEFAULT_POSITION];
    } catch (e) {
      return [DEFAULT_POSITION];
    }
  });
  const [activeId, setActiveId] = useState<string>(positions[0]?.id || DEFAULT_POSITION.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CoinSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);
  const [apiError, setApiError] = useState<{message: string; type: 'error' | 'warning'} | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }, [positions]);

  const activePosition = useMemo(() => 
    positions.find(p => p.id === activeId) || positions[0] || DEFAULT_POSITION, 
  [positions, activeId]);

  const updateActivePosition = useCallback((updates: Partial<PositionState>) => {
    setPositions(prev => prev.map(p => p.id === activeId ? { ...p, ...updates } : p));
  }, [activeId]);

  // Fix: Add missing addNewPosition function
  const addNewPosition = useCallback(() => {
    const newId = Date.now().toString();
    const newPos: PositionState = {
      ...DEFAULT_POSITION,
      id: newId,
      symbol: 'NEW',
      coinId: '',
      lastUpdated: Date.now()
    };
    setPositions(prev => [...prev, newPos]);
    setActiveId(newId);
  }, []);

  // Fix: Add missing deletePosition function
  const deletePosition = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (positions.length <= 1) return;
    
    setPositions(prev => {
      const updated = prev.filter(p => p.id !== id);
      if (activeId === id) {
        setActiveId(updated[0]?.id || '');
      }
      return updated;
    });
  }, [activeId, positions.length]);

  // 执行补仓逻辑：更新持仓数量和均价
  const handleExecuteTrade = (actualPrice: number, actualCost: number) => {
    const currentAvgPrice = parseFloat(activePosition.avgPrice as string) || 0;
    const currentHoldings = parseFloat(activePosition.holdings as string) || 0;
    const currentAvailableFunds = parseFloat(activePosition.availableFunds as string) || 0;

    const newCoins = actualCost / actualPrice;
    const totalCoins = currentHoldings + newCoins;
    const totalCost = (currentAvgPrice * currentHoldings) + actualCost;
    const newAvgPrice = totalCost / totalCoins;

    updateActivePosition({
      holdings: totalCoins,
      avgPrice: newAvgPrice,
      availableFunds: Math.max(0, currentAvailableFunds - actualCost),
      currentPrice: actualPrice, // 补仓后通常现价即为触发价
      lastUpdated: Date.now()
    });

    setApiError({ message: `补仓成功！已更新 ${activePosition.symbol} 持仓。`, type: 'warning' });
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setApiError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("API 响应错误");
        const data = await res.json();
        setSearchResults(data.coins?.slice(0, 6) || []);
      } catch (e: any) {
        setApiError({ message: "搜索失败，API 访问受限", type: 'error' });
      } finally {
        setIsSearching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const refreshPrice = async (coinId: string) => {
    if (!coinId) return;
    setIsPriceUpdating(true);
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      const data = await res.json();
      if (data[coinId]?.usd) {
        updateActivePosition({ 
          currentPrice: data[coinId].usd,
          lastUpdated: Date.now()
        });
      }
    } catch (e: any) {
      setApiError({ message: "价格同步失败", type: 'warning' });
    } finally {
      setIsPriceUpdating(false);
    }
  };

  const simulationRows: SimulationRow[] = useMemo(() => {
    const rows: SimulationRow[] = [];
    const avgPriceNum = parseFloat(activePosition.avgPrice as string) || 0;
    const holdingsNum = parseFloat(activePosition.holdings as string) || 0;
    const currentPriceNum = parseFloat(activePosition.currentPrice as string) || 0;
    const availableFunds = parseFloat(activePosition.availableFunds as string) || 0;
    const dropStep = parseFloat(activePosition.dropStep as string) || 0;
    const multiplier = parseFloat(activePosition.multiplier as string) || 1;
    const baseBuy = parseFloat(activePosition.baseBuy as string) || 0;

    if (currentPriceNum <= 0 || dropStep <= 0 || baseBuy <= 0) return rows;

    let runningFunds = availableFunds;
    let runningCoins = holdingsNum;
    let runningCost = avgPriceNum * holdingsNum;
    let nextTriggerPrice = currentPriceNum;

    for (let i = 0; i < 15; i++) {
      nextTriggerPrice = nextTriggerPrice * (1 - dropStep / 100);
      
      // 根据策略计算补仓金额
      let investment = 0;
      if (activePosition.strategyType === 'martingale') {
        investment = baseBuy * Math.pow(multiplier, i);
      } else {
        investment = baseBuy; // 等额策略
      }

      const coinsBought = investment / nextTriggerPrice;
      const projectedTotalCoins = runningCoins + coinsBought;
      const projectedTotalCost = runningCost + investment;
      const newAvgPrice = projectedTotalCost / projectedTotalCoins;
      const breakEvenRebound = ((newAvgPrice - nextTriggerPrice) / nextTriggerPrice) * 100;
      const currentDropPercent = ((currentPriceNum - nextTriggerPrice) / currentPriceNum) * 100;
      
      runningFunds -= investment;
      rows.push({
        level: i + 1,
        triggerPrice: nextTriggerPrice,
        buyCost: investment,
        coinsBought,
        totalCoins: projectedTotalCoins,
        totalCost: projectedTotalCost,
        newAvgPrice,
        breakEvenRebound,
        remainingFunds: runningFunds,
        isAffordable: runningFunds >= 0,
        dropPercent: currentDropPercent
      });
      runningCoins = projectedTotalCoins;
      runningCost = projectedTotalCost;
    }
    return rows;
  }, [activePosition]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col font-sans">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Calculator size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide uppercase">Crypto Recovery</h1>
            <p className="text-[10px] text-gray-500 font-mono">Position & DCA Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 bg-gray-800/50 px-3 py-1.5 rounded border border-gray-700 font-mono">
             <Clock size={12} />
             <span>SYNC: {activePosition.lastUpdated ? new Date(activePosition.lastUpdated).toLocaleTimeString() : 'N/A'}</span>
           </div>
           <button 
             onClick={() => refreshPrice(activePosition.coinId)}
             disabled={isPriceUpdating}
             className={`p-2 rounded-lg hover:bg-gray-800 transition-colors ${isPriceUpdating ? 'animate-spin text-blue-400' : 'text-gray-400'}`}
           >
             <RefreshCw size={18} />
           </button>
        </div>
      </header>

      {apiError && (
        <div className={`px-6 py-2 flex items-center gap-3 text-xs animate-in slide-in-from-top ${
          apiError.type === 'error' ? 'bg-rose-900/40 text-rose-200' : 'bg-blue-900/30 text-blue-200'
        } border-b border-gray-800`}>
          <AlertTriangle size={14} className="flex-shrink-0" />
          <span className="font-medium">{apiError.message}</span>
          <button onClick={() => setApiError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <aside className="w-full lg:w-[380px] flex-shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center gap-2 overflow-x-auto no-scrollbar bg-gray-900/50">
            {positions.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveId(p.id); setApiError(null); }}
                className={`flex-shrink-0 group flex items-center gap-2 px-3 py-2 rounded text-xs font-bold transition-all border ${
                  activeId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {p.symbol}
                {positions.length > 1 && <Trash2 size={12} className="opacity-0 group-hover:opacity-100" onClick={(e) => deletePosition(p.id, e)} />}
              </button>
            ))}
            <button onClick={addNewPosition} className="p-2 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-blue-400"><Plus size={16} /></button>
          </div>

          <div className="p-6 space-y-6">
            {/* 账户卡片 */}
            <div className="bg-gray-950 rounded-xl border border-gray-800 p-5 shadow-inner relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold text-gray-400 flex items-center gap-2 tracking-widest uppercase">
                  <Activity size={14} className="text-blue-500" /> 持仓实况
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${parseFloat(activePosition.avgPrice as string) > parseFloat(activePosition.currentPrice as string) ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                   {(((parseFloat(activePosition.currentPrice as string) - parseFloat(activePosition.avgPrice as string)) / parseFloat(activePosition.avgPrice as string)) * 100 || 0).toFixed(2)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[10px] text-gray-500 mb-1">当前持有 ({activePosition.symbol})</p>
                   <p className="text-sm font-mono font-bold text-white">{parseFloat(activePosition.holdings as string).toLocaleString()}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-gray-500 mb-1">持仓均价</p>
                   <p className="text-sm font-mono font-bold text-amber-400">${parseFloat(activePosition.avgPrice as string).toLocaleString()}</p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <Search size={14} /> 币种检索
              </h3>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="搜索币种更换当前仓位..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-gray-600" />
                {isSearching && <Loader2 size={14} className="absolute right-3 top-2.5 text-blue-500 animate-spin" />}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 overflow-hidden">
                    {searchResults.map(coin => (
                      <button
                        key={coin.id}
                        onClick={() => { updateActivePosition({ symbol: coin.symbol.toUpperCase(), coinId: coin.id }); setSearchQuery(''); setSearchResults([]); refreshPrice(coin.id); }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 text-left border-b border-gray-800 last:border-0"
                      >
                        <img src={coin.thumb} alt="" className="w-4 h-4 rounded-full" />
                        <span className="text-xs font-bold text-white">{coin.name} ({coin.symbol.toUpperCase()})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="修正持仓量" value={activePosition.holdings} onChange={(val) => updateActivePosition({ holdings: val })} suffix={activePosition.symbol} />
              <InputGroup label="修正均价" value={activePosition.avgPrice} onChange={(val) => updateActivePosition({ avgPrice: val })} prefix="$" />
            </div>

            <InputGroup label="实时现价" value={activePosition.currentPrice} onChange={(val) => updateActivePosition({ currentPrice: val })} prefix="$" />

            <div className="pt-4 border-t border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={14} /> 补仓策略
                </h3>
                <select 
                  value={activePosition.strategyType}
                  onChange={(e) => updateActivePosition({ strategyType: e.target.value as StrategyType })}
                  className="bg-gray-800 text-[10px] text-gray-300 border-none rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="martingale">马丁格尔 (倍投)</option>
                  <option value="fixed">等额 DCA</option>
                </select>
              </div>

              <InputGroup label="补仓可用预算" value={activePosition.availableFunds} onChange={(val) => updateActivePosition({ availableFunds: val })} prefix="$" />
              
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="下跌步长" value={activePosition.dropStep} onChange={(val) => updateActivePosition({ dropStep: val })} suffix="%" />
                {activePosition.strategyType === 'martingale' && (
                  <InputGroup label="马丁系数" value={activePosition.multiplier} onChange={(val) => updateActivePosition({ multiplier: val })} suffix="x" step="0.1" />
                )}
              </div>
              <InputGroup label="首单金额 (Base)" value={activePosition.baseBuy} onChange={(val) => updateActivePosition({ baseBuy: val })} prefix="$" />
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-gray-950 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-200 flex items-center gap-2 tracking-widest uppercase">
              <BarChart2 size={16} className="text-blue-500" /> {activePosition.strategyType === 'martingale' ? '马丁格尔' : '等额 DCA'} 补仓推演
            </h2>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <SimulationTable 
              rows={simulationRows} 
              symbol={activePosition.symbol} 
              onExecute={handleExecuteTrade}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
