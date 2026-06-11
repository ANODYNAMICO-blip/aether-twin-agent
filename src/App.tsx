import React, { useMemo, useState } from 'react';
import { 
  Activity, 
  Shield, 
  Zap, 
  TrendingUp, 
  Database, 
  Cpu, 
  AlertTriangle,
  Layers,
  Terminal,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useAetherSimulation } from './hooks/useAetherSimulation';
import { cn } from './lib/utils';

const StatCard = ({ title, value, icon: Icon, trend, color, subtitle }: any) => (
  <div className="bg-[#111215] border border-[#232429] p-4 rounded-lg flex flex-col gap-2 relative overflow-hidden group">
    <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full blur-2xl group-hover:bg-white/[0.02] transition-colors" />
    <div className="flex items-center justify-between z-10">
      <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98]">{title}</span>
      <Icon size={14} className={color} />
    </div>
    <div className="flex items-baseline gap-2 z-10">
      <span className="text-xl font-mono text-white tracking-tight">{value}</span>
      {trend !== undefined && (
        <span className={cn("text-[10px] font-mono", trend > 0 ? "text-emerald-400" : "text-rose-400")}>
          {trend > 0 ? '+' : ''}{trend.toFixed(2)}%
        </span>
      )}
    </div>
    {subtitle && (
      <span className="text-[9px] font-mono text-[#5A5C63] z-10">{subtitle}</span>
    )}
  </div>
);

const ActionIndicator = ({ action }: { action: string }) => {
  const colors = {
    Conservative: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    Balanced: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    Aggressive: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  };

  return (
    <div className={cn(
      "px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest flex items-center gap-2",
      colors[action as keyof typeof colors]
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full animate-bounce", colors[action as keyof typeof colors].split(' ')[0])} />
      {action}
    </div>
  );
};

export default function App() {
  const { state, updatePPOConfig } = useAetherSimulation();
  const [activeTab, setActiveTab] = useState<'buffers' | 'config' | 'training'>('buffers');

  const avgRug = useMemo(() => {
    if (state.tokens.length === 0) return 0;
    return state.tokens.reduce((acc, t) => acc + t.rug_score, 0) / state.tokens.length;
  }, [state.tokens]);

  const recentHistory = useMemo(() => state.history.slice(-40), [state.history]);

  return (
    <div className="min-h-screen bg-[#08090B] text-[#D1D5DB] font-sans p-4 md:p-6 selection:bg-white/10">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between border-b border-[#212328] pb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded shadow-lg shadow-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 to-purple-500/20" />
            <Cpu className="text-black relative z-10 animate-pulse" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-mono font-bold tracking-tighter uppercase text-white">Aether Twin Agent</h1>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">PPO v2.5</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#8E9299] font-mono mt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                SYSTEM ONLINE
              </span>
              <span className="opacity-30">|</span>
              <span>EPOCH STEP: <strong className="text-white">{state.episode_step_counter}</strong>/{state.ppo_config.ppo_max_episode_steps}</span>
              <span className="opacity-30">|</span>
              <span>TOTAL STEPS: <strong className="text-zinc-300">{state.step}</strong></span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-[#111215] border border-[#232429] p-3 rounded-lg flex items-center gap-4">
            <div className="text-left">
              <div className="text-[9px] font-mono text-[#8E9299] uppercase mb-0.5">Episode Progress</div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-[#232429] rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-300", 
                      state.episode_step_counter > state.ppo_config.ppo_max_episode_steps * 0.8 ? "bg-rose-500 animate-pulse" : "bg-white"
                    )}
                    style={{ width: `${(state.episode_step_counter / state.ppo_config.ppo_max_episode_steps) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-white">
                  {Math.round((state.episode_step_counter / state.ppo_config.ppo_max_episode_steps) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-mono text-[#8E9299] uppercase mb-1">PPO Policy Decision</div>
            <ActionIndicator action={state.last_action} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Stats / Sliders / Swarm) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Key Indicators Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard 
              title="ETH Balance" 
              value={`${state.eth_balance.toFixed(4)} ETH`} 
              icon={TrendingUp} 
              color="text-sky-400"
              subtitle="Collateral Wallet"
            />
            <StatCard 
              title="Portfolio Value" 
              value={`$${state.portfolio_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
              icon={Database} 
              color="text-purple-400"
              subtitle="Simulated Assets"
            />
            <StatCard 
              title="Active Tokens" 
              value={state.tokens.length} 
              icon={Layers} 
              color="text-emerald-400"
              subtitle="In Rollout Cache"
            />
            <StatCard 
              title="Avg Rug Risk" 
              value={avgRug.toFixed(3)} 
              icon={Shield} 
              color={avgRug > 0.6 ? "text-rose-400 animate-pulse" : "text-sky-400"}
              subtitle="State vector feature [1]"
            />
          </div>

          {/* Swarm Intelligence and Decision Vectors */}
          <div className="bg-[#111215] border border-[#232429] p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98]">Swarm Signal (Feature [2])</span>
              <span className="text-[10px] font-mono text-white">{(state.swarm_signal * 100).toFixed(1)}% Strength</span>
            </div>
            <div className="h-1.5 w-full bg-[#1E2024] rounded-full overflow-hidden mb-4">
              <motion.div 
                className="h-full bg-gradient-to-r from-sky-400 to-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${state.swarm_signal * 100}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2 bg-[#0C0D0F] border border-[#1E2024] rounded">
              <div className="flex justify-between border-r border-[#1E2024] pr-2">
                <span className="text-[#8A8F98]">Log Prob:</span>
                <span className="text-white">{state.last_log_prob.toFixed(4)}</span>
              </div>
              <div className="flex justify-between pl-2">
                <span className="text-[#8A8F98]">Est. Value:</span>
                <span className="text-white">{state.last_value.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Tabs Menu for Config and Diagnostic Tools */}
          <div className="bg-[#111215] border border-[#232429] rounded-lg overflow-hidden">
            <div className="flex border-b border-[#232429] bg-[#16171C]">
              <button 
                onClick={() => setActiveTab('buffers')}
                className={cn(
                  "flex-1 py-2.5 text-[10px] font-mono uppercase tracking-widest text-center border-r border-[#232429] hover:bg-white/[0.02] transition-colors",
                  activeTab === 'buffers' ? "bg-[#111215] text-white font-bold" : "text-zinc-400"
                )}
              >
                Agent Buffer
              </button>
              <button 
                onClick={() => setActiveTab('config')}
                className={cn(
                  "flex-1 py-2.5 text-[10px] font-mono uppercase tracking-widest text-center border-r border-[#232429] hover:bg-white/[0.02] transition-colors",
                  activeTab === 'config' ? "bg-[#111215] text-white font-bold" : "text-zinc-400"
                )}
              >
                Hyperparams
              </button>
              <button 
                onClick={() => setActiveTab('training')}
                className={cn(
                  "flex-1 py-2.5 text-[10px] font-mono uppercase tracking-widest text-center hover:bg-white/[0.02] transition-colors",
                  activeTab === 'training' ? "bg-[#111215] text-white font-bold" : "text-zinc-400"
                )}
              >
                Optimiser
              </button>
            </div>

            <div className="p-4 bg-[#111215]">
              {/* Buffer Tab */}
              {activeTab === 'buffers' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-zinc-400 uppercase">Rollout transitions:</span>
                    <span className="text-white font-bold">{state.rollout_transitions.length} / {state.ppo_config.ppo_train_every}</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#1A1C21] rounded overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (state.rollout_transitions.length / state.ppo_config.ppo_train_every) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 leading-normal">
                    Transitions are accumulated until rollout steps reach training trigger (<span className="text-zinc-300">{state.ppo_config.ppo_train_every}</span>) or the current episode triggers <span className="text-zinc-300 font-bold">done=True</span>.
                  </p>
                  
                  {state.rollout_transitions.length > 0 && (
                    <div className="border border-[#232429] rounded p-2 bg-[#090A0C] mt-1">
                      <span className="text-[9px] font-mono uppercase text-[#8A8F98] block mb-1">Latest collected log_prob:</span>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-indigo-400">Idx: {state.rollout_transitions[state.rollout_transitions.length - 1].actionIdx}</span>
                        <span className="text-[#8E9299]">log_prob:</span>
                        <span className="text-amber-400">{state.rollout_transitions[state.rollout_transitions.length - 1].logProb.toFixed(5)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hyperparam Tuner Tab */}
              {activeTab === 'config' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-[#8A8F98] uppercase">Max Episode Steps:</span>
                      <span className="text-white font-bold">{state.ppo_config.ppo_max_episode_steps}</span>
                    </div>
                    <input 
                      type="range" 
                      min="30" 
                      max="300" 
                      step="10"
                      value={state.ppo_config.ppo_max_episode_steps}
                      onChange={(e) => updatePPOConfig({ ppo_max_episode_steps: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1E2024] rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-[#5A5C63] mt-0.5">
                      <span>30 steps</span>
                      <span>300 steps</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-[#8A8F98] uppercase">PPO Update Every:</span>
                      <span className="text-white font-bold">{state.ppo_config.ppo_train_every} steps</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="80" 
                      step="2"
                      value={state.ppo_config.ppo_train_every}
                      onChange={(e) => updatePPOConfig({ ppo_train_every: Number(e.target.value) })}
                      className="w-full h-1 bg-[#1E2024] rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-[#5A5C63] mt-0.5">
                      <span>10 steps</span>
                      <span>80 steps</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E2024]">
                    <div>
                      <span className="text-[8px] font-mono uppercase text-[#8A8F98]">gamma</span>
                      <div className="text-xs font-mono text-zinc-200">0.99</div>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono uppercase text-[#8A8F98]">gae_lambda</span>
                      <div className="text-xs font-mono text-zinc-200">0.95</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Training Statistics Tab */}
              {activeTab === 'training' && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-400 uppercase">Optimizer status:</span>
                    <span className="text-[#4ADE80] font-bold flex items-center gap-1">
                      <CheckCircle size={10} /> ACTIVE
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2.5 bg-[#0C0D0F] border border-[#1E2024] rounded leading-relaxed">
                    <div>
                      <span className="text-zinc-500 block text-[8px] uppercase">lr (Learning Rate)</span>
                      <span className="text-white">3e-4</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[8px] uppercase">clip eps</span>
                      <span className="text-white">0.2</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[8px] uppercase">entropy coef</span>
                      <span className="text-white">0.01</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[8px] uppercase">ppo updates</span>
                      <span className="text-white font-bold">{state.ppo_updates_count}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Terminal Logs Console */}
          <div className="bg-[#111215] border border-[#232429] rounded-lg overflow-hidden flex flex-col h-[200px]">
            <div className="bg-[#16171C] px-3 py-2 border-b border-[#232429] flex items-center gap-2">
              <Terminal size={12} className="text-[#8E9299]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8E9299]">Episodic Transition log</span>
            </div>
            <div className="p-3 font-mono text-[10px] overflow-y-auto flex flex-col gap-1 scrollbar-hide flex-1 bg-[#090A0C]">
              <AnimatePresence mode="popLayout">
                {state.history.slice(-8).reverse().map((h, i) => (
                  <motion.div 
                    key={h.step}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap gap-x-2 border-b border-white/[0.02] pb-1"
                  >
                    <span className="text-[#4A4B50]">[{h.step.toString().padStart(4, '0')}]</span>
                    <span className={cn(
                      h.action === 'Aggressive' ? 'text-rose-400 font-bold' : 
                      h.action === 'Conservative' ? 'text-sky-400 font-bold' : 'text-emerald-400 font-bold'
                    )}>
                      {h.action.toUpperCase()}
                    </span>
                    <span className="text-zinc-400">rew:</span>
                    <span className={h.reward >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {h.reward.toFixed(4)}
                    </span>
                    {h.done && (
                      <span className="text-[9px] font-bold px-1 bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                        DONE=TRUE
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column (Charts, Rollouts Buffer Matrix table) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Main Visualizer Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Portfolio Chart card */}
            <div className="bg-[#111215] border border-[#232429] p-4 rounded-lg h-[320px] flex flex-col">
              <div className="flex items-center justify-between mb-3 z-10">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">Portfolio performance ($)</span>
                <span className="text-[9px] font-mono text-zinc-500 font-semibold">Updated each step</span>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentHistory}>
                    <defs>
                      <linearGradient id="gradientPrimary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818CF8" stopOpacity={0.12}/>
                        <stop offset="95%" stopColor="#818CF8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1D1E22" vertical={false} />
                    <XAxis 
                      dataKey="step" 
                      stroke="#4A4B50" 
                      fontSize={8} 
                      fontFamily="monospace" 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#4A4B50" 
                      fontSize={8} 
                      fontFamily="monospace" 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111215', border: '1px solid #232429', borderRadius: '6px' }}
                      itemStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                      labelStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#888' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="portfolio_value" 
                      stroke="#818CF8" 
                      fillOpacity={1} 
                      fill="url(#gradientPrimary)" 
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Neural Net Update Log console */}
            <div className="bg-[#111215] border border-[#232429] p-4 rounded-lg h-[320px] flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-[#232429] pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">PPO Network Weight Updator Log</span>
                <span className="text-[9px] font-mono text-[#4ADE80] bg-[#4ADE80]/15 px-1.5 py-0.5 rounded border border-[#4ADE80]/20 font-bold uppercase tracking-wider animate-pulse">active optimizer</span>
              </div>
              <div className="flex-1 bg-[#090A0C] border border-[#1E2024] p-3 rounded font-mono text-[9.5px] text-[#4ADE80]/90 leading-relaxed overflow-y-auto whitespace-pre-wrap select-text selection:bg-[#4ADE80]/20 selection:text-[#4ADE80] break-all">
                {state.latest_train_log ? state.latest_train_log : (
                  <div className="text-zinc-500 h-full flex flex-col justify-center items-center gap-2">
                    <Terminal size={24} className="opacity-40" />
                    <span>Waiting for rollout buffer optimization step...</span>
                    <span className="text-[8.5px] opacity-60 text-center px-4">
                      Training runs automatically when the buffer reaches limit ({state.ppo_config.ppo_train_every}) or on episode boundaries done=True.
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Current Rollout Buffer Matrix / Diagnostic Table */}
          <div className="bg-[#111215] border border-[#232429] rounded-lg overflow-hidden flex flex-col">
            <div className="bg-[#16171C] px-4 py-3 border-b border-[#232429] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-white font-bold">Active Rollout Memory Buffer (old_log_probs)</h3>
                <p className="text-[9px] font-mono text-zinc-500 mt-0.5">Captures transitions sequence & Log Probability to compute offline gradients</p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-purple-300 font-bold border border-zinc-700">
                Size: {state.rollout_transitions.length} / {state.ppo_config.ppo_train_every}
              </span>
            </div>

            <div className="overflow-x-auto select-text">
              <table className="w-full text-left font-mono text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2024] text-[#8E9299] uppercase tracking-tighter bg-[#16171C]/50 text-[9px]">
                    <th className="px-4 py-3 font-semibold">T-Step</th>
                    <th className="px-4 py-3 font-semibold">State Features (Tokens / Rug / Swarm / Collateral)</th>
                    <th className="px-4 py-3 font-semibold">Decision (Action)</th>
                    <th className="px-4 py-3 font-semibold text-amber-300">Log Prob (old_log_prob)</th>
                    <th className="px-4 py-3 font-semibold text-emerald-300">Reward</th>
                    <th className="px-4 py-3 font-semibold text-rose-300">Done</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2024]">
                  {state.rollout_transitions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                        <Database size={16} className="mx-auto opacity-30 mb-1" />
                        <span>Buffer is empty. Accumulating step transitions in memory...</span>
                      </td>
                    </tr>
                  ) : (
                    state.rollout_transitions.slice(-6).map((t, index) => (
                      <tr key={index} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-2.5 text-zinc-400">#{t.step}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-zinc-500 font-bold mr-1">[{t.stateVector[0].toFixed(2)}, {t.stateVector[1].toFixed(2)}, {t.stateVector[2].toFixed(2)}, {t.stateVector[3].toFixed(2)}]</span>
                          <span className="text-[9px] text-[#5A5C63]">...</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold",
                            t.actionIdx === 0 ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" :
                            t.actionIdx === 1 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          )}>
                            {t.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-amber-300">{t.logProb.toFixed(5)}</td>
                        <td className="px-4 py-2.5 font-bold text-emerald-400">{t.reward >= 0 ? '+' : ''}{t.reward.toFixed(4)}</td>
                        <td className="px-4 py-2.5">
                          {t.done ? (
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[8px] font-bold uppercase animate-pulse">
                              True (EOC)
                            </span>
                          ) : (
                            <span className="text-[#5A5C63]">False</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Tokens Inventory Section */}
          <div className="bg-[#111215] border border-[#232429] rounded-lg overflow-hidden">
            <div className="bg-[#16171C] px-4 py-3 border-b border-[#232429] flex items-center justify-between">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-white font-bold">State environment database (active assets)</h3>
              <span className="text-[9px] font-mono text-zinc-500">{state.tokens.length} tokens simulated</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-[#1E2024] text-[#8E9299] uppercase tracking-tighter text-[9px] bg-[#16171C]/20">
                    <th className="px-4 py-3 font-semibold">Asset Sym</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold text-center">Rug index Score (State [1])</th>
                    <th className="px-4 py-3 font-semibold">State Analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2024]">
                  {state.tokens.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-zinc-600">No active synthetic assets in memory buffer.</td>
                    </tr>
                  ) : (
                    state.tokens.slice(0, 6).map((token) => (
                      <tr key={token.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-2 text-white font-bold">{token.symbol}-DEFI</td>
                        <td className="px-4 py-2 text-zinc-300 font-bold">${token.value.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                            <span className="w-8 text-[9px] text-zinc-500 text-right font-bold">{token.rug_score.toFixed(2)}</span>
                            <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full",
                                  token.rug_score > 0.7 ? "bg-rose-500" : 
                                  token.rug_score > 0.4 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${token.rug_score * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {token.rug_score > 0.75 ? (
                            <span className="text-rose-400 font-semibold flex items-center gap-1 text-[9px]">
                              <AlertTriangle size={10} className="animate-bounce" /> HIGH RUG RISK
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[9px] font-semibold">ENVIRONMENT ENHANCED</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      {/* Footer / Status Bar with Neural Parameters */}
      <footer className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[#212328] flex flex-col md:flex-row md:items-center justify-between text-[9px] font-mono text-[#5A5C63] uppercase tracking-[0.2em] gap-4">
        <div className="flex flex-wrap gap-6 text-zinc-500">
          <span>Active Policy: <strong className="text-zinc-400">PPOAgent</strong></span>
          <span>Buffer: <strong className="text-zinc-400">Log_Probs Array Loaded</strong></span>
          <span>Episode Step Cutoff: <strong className="text-zinc-400">ppo_max_episode_steps ({state.ppo_config.ppo_max_episode_steps})</strong></span>
          <span>done handling: <strong className="text-zinc-400">buffer cleared</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>REAL-TIME PPO GRAPH SYNC ACTIVE</span>
        </div>
      </footer>
    </div>
  );
}

