export interface SimulationRow {
  level: number;
  triggerPrice: number;
  buyCost: number;
  coinsBought: number;
  totalCoins: number;
  totalCost: number;
  newAvgPrice: number;
  breakEvenRebound: number;
  remainingFunds: number;
  isAffordable: boolean;
  dropPercent: number;
}

export type StrategyType = 'martingale' | 'fixed';

export interface PositionState {
  id: string;
  symbol: string;
  coinId: string;
  avgPrice: number | string;
  holdings: number | string;
  currentPrice: number | string;
  availableFunds: number | string;
  dropStep: number | string;
  multiplier: number | string;
  baseBuy: number | string;
  strategyType: StrategyType; // 策略类型
  lastUpdated?: number;
}

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
}