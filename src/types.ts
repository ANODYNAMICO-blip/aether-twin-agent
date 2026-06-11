export type ActionMode = 'Conservative' | 'Balanced' | 'Aggressive';

export interface Token {
  id: string;
  symbol: string;
  rug_score: number;
  value: number;
}

export interface RolloutTransition {
  step: number;
  stateVector: number[];
  action: ActionMode;
  actionIdx: number;
  logProb: number;
  reward: number;
  done: boolean;
  value: number;
}

export interface PPOConfig {
  state_dim: number;
  action_dim: number;
  lr: number;
  clip_eps: number;
  entropy_coef: number;
  gae_lambda: number;
  gamma: number;
  ppo_train_every: number;
  ppo_max_episode_steps: number;
  checkpoint_save_interval: number; // Interval in training updates (e.g., every 5 updates)
}

export interface PPOCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  updates_count: number;
  reward_mean: number;
  actor_weights: number[][];
  critic_weights: number[];
}

export interface RewardBreakdown {
  profit: number;
  rug_penalty: number;
  diversification_bonus: number;
  tx_fee_penalty: number;
}

export interface AetherState {
  eth_balance: number;
  portfolio_value: number;
  tokens: Token[];
  swarm_signal: number;
  step: number;
  episode_step_counter: number;
  last_action: ActionMode;
  last_reward: number;
  last_log_prob: number;
  last_value: number;
  ppo_config: PPOConfig;
  
  // PPO Rollout Buffer representing the AetherTwin internal states
  rollout_transitions: RolloutTransition[];
  ppo_updates_count: number;
  latest_train_log: string | null;

  // Save/Load model states and weights
  actor_weights: number[][];  // shape: [action_dim, state_dim]
  critic_weights: number[];   // shape: [state_dim]
  checkpoints: PPOCheckpoint[];
  latest_saved_time: string | null;

  // Enhanced reward system breakdowns
  reward_breakdown: RewardBreakdown;

  history: {
    step: number;
    portfolio_value: number;
    reward: number;
    action: ActionMode;
    done: boolean;
  }[];
}

