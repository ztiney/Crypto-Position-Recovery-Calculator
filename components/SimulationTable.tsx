import React, { useState } from 'react';
import { SimulationRow } from '../types';
import { TrendingDown, AlertCircle, CheckCircle2, PlayCircle } from 'lucide-react';

interface SimulationTableProps {
  rows: SimulationRow[];
  symbol: string;
  onExecute: (price: number, cost: number) => void;
}

export const SimulationTable: React.FC<SimulationTableProps> = ({ rows, symbol, onExecute }) => {
  const [executingRow, setExecutingRow] = useState<number | null>(null);
  const [actualCost, setActualCost] = useState<string>("");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatCrypto = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(val);
  };

  if (rows.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
        <TrendingDown size={48} className="mb-4" />
        <p className="text-sm">请输入参数开始策略推演</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full text-[11px] text-left">
        <thead className="text-[10px] text-gray-500 uppercase bg-gray-900 sticky top-0 z-10 font-mono tracking-tighter">
          <tr>
            <th className="px-4 py-3 border-b border-gray-800">触发价/跌幅</th>
            <th className="px-4 py-3 border-b border-gray-800">补仓金额</th>
            <th className="px-4 py-3 border-b border-gray-800 text-right">新持仓量</th>
            <th className="px-4 py-3 border-b border-gray-800 text-right text-amber-500">🔥 摊平后均价</th>
            <th className="px-4 py-3 border-b border-gray-800 text-right">回本反弹</th>
            <th className="px-4 py-3 border-b border-gray-800 text-center">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {rows.map((row, index) => {
            const isInsufficient = !row.isAffordable;
            const isEditing = executingRow === index;
            
            return (
              <tr 
                key={index} 
                className={`${isInsufficient ? 'opacity-30 bg-gray-950' : 'hover:bg-gray-800/30'} transition-colors`}
              >
                <td className="px-4 py-3 font-mono">
                  <div className="flex flex-col">
                    <span className="text-gray-200">${row.triggerPrice.toLocaleString()}</span>
                    <span className="text-rose-500 font-bold">-{row.dropPercent.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <input 
                        type="number"
                        autoFocus
                        value={actualCost}
                        onChange={(e) => setActualCost(e.target.value)}
                        className="bg-gray-800 border border-blue-500 rounded px-1.5 py-1 text-white text-[10px] w-20 outline-none"
                        placeholder="实投金额"
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400 font-mono">{formatCurrency(row.buyCost)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-400">
                  {formatCrypto(row.totalCoins)} <span className="text-[8px] opacity-50 uppercase">{symbol}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-amber-500">
                  {formatCurrency(row.newAvgPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <span className={`${row.breakEvenRebound > 20 ? 'text-rose-400' : 'text-emerald-400'} font-bold`}>
                    +{row.breakEvenRebound.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {isEditing ? (
                    <div className="flex items-center justify-center gap-2">
                       <button 
                         onClick={() => {
                           const cost = parseFloat(actualCost) || row.buyCost;
                           onExecute(row.triggerPrice, cost);
                           setExecutingRow(null);
                         }}
                         className="p-1.5 bg-emerald-600 rounded text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
                       >
                         <CheckCircle2 size={14} />
                       </button>
                       <button 
                         onClick={() => setExecutingRow(null)}
                         className="p-1.5 bg-gray-700 rounded text-gray-300 hover:bg-gray-600"
                       >
                         <X size={14} />
                       </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setExecutingRow(index);
                        setActualCost(row.buyCost.toString());
                      }}
                      disabled={isInsufficient}
                      className={`flex items-center gap-1 mx-auto px-2 py-1 rounded border ${isInsufficient ? 'border-gray-800 text-gray-700 cursor-not-allowed' : 'border-blue-900 text-blue-400 hover:bg-blue-900/30 transition-all active:scale-95'}`}
                    >
                      <PlayCircle size={12} />
                      <span className="font-bold">执行</span>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const X = ({size}: {size: number}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);