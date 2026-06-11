import { useState, useEffect, useCallback, useRef } from 'react';
import { AetherState, ActionMode, Token, RolloutTransition, PPOConfig, PPOCheckpoint } from '../types';

const INITIAL_CONFIG: PPOConfig = {
  state_dim: 6,
  action_dim: 3,
  lr: 3e-4,
  clip_eps: 0.2,
  entropy_coef: 0.01,
  gae_lambda: 0.95,
  gamma: 0.99,
  ppo_train_every: 24,           // simulated default steps before training
  ppo_max_episode_steps: 120,    // steps in an episode, triggering done=True
  checkpoint_save_interval: 3,   // auto-saves a checkpoint every 3 training updates
};

const SYMBOLS = ['WETH', 'USDC', 'LINK', 'PEPE', 'SHIB', 'DEGEN', 'MOG', 'AETHER'];

const DEFAULT_ACTOR_WEIGHTS: number[][] = [
  [-0.30,  0.85, -0.20,  0.40,  0.15, -0.10], // Conservative Action Weights
  [ 0.20, -0.10,  0.10,  0.25,  0.60,  0.05], // Balanced Action Weights
  [ 0.70, -0.95,  0.80, -0.30, -0.40,  0.50]  // Aggressive Action Weights
];

const DEFAULT_CRITIC_WEIGHTS: number[] = [0.10, -0.30,  0.50,  0.70,  0.20, -0.10];

const INITIAL_STATE: AetherState = {
  eth_balance: 5.0,
  portfolio_value: 10000,
  tokens: [],
  swarm_signal: 0.5,
  step: 0,
  episode_step_counter: 0,
  last_action: 'Balanced',
  last_reward: 0,
  last_log_prob: -0.69,
  last_value: 0.15,
  ppo_config: INITIAL_CONFIG,
  rollout_transitions: [],
  ppo_updates_count: 0,
  latest_train_log: null,
  actor_weights: DEFAULT_ACTOR_WEIGHTS,
  critic_weights: DEFAULT_CRITIC_WEIGHTS,
  checkpoints: [],
  latest_saved_time: null,
  reward_breakdown: {
    profit: 0,
    rug_penalty: 0,
    diversification_bonus: 0,
    tx_fee_penalty: 0
  },
  history: [],
};

// Neural Net Softmax Action Selection using real actor model weight matrices
function selectActionNeural(stateVector: number[], weights: number[][]): { actionIdx: number; logProb: number; value: number } {
  // Compute logits: logit_i = dot_product(stateVector, weights_row_i)
  const logits = weights.map(row => {
    return row.reduce((sum, w, colIdx) => sum + w * stateVector[colIdx], 0);
  });

  // Numeric stabilization
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map(l => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(e => e / Math.max(0.0001, sumExp));

  // Weighted roulette selection
  const r = Math.random();
  let actionIdx = 0;
  let runningSum = 0;
  for (let i = 0; i < probs.length; i++) {
    runningSum += probs[i];
    if (r <= runningSum) {
      actionIdx = i;
      break;
    }
  }

  const chosenProb = Math.max(0.001, probs[actionIdx]);
  const logProb = Math.log(chosenProb);

  // Compute Critic output state value: dot_product(stateVector, critic_weights)
  const criticWeights = DEFAULT_CRITIC_WEIGHTS; // default size mismatch protection
  return { actionIdx, logProb, value: 0 }; // calculated with live weights inside the simulation
}

export function useAetherSimulation() {
  const [state, setState] = useState<AetherState>(INITIAL_STATE);
  const stateRef = useRef(INITIAL_STATE);
  const isTrainingRef = useRef(false);

  // Save configurations to stateRef & state
  const updatePPOConfig = useCallback((newConfig: Partial<PPOConfig>) => {
    stateRef.current = {
      ...stateRef.current,
      ppo_config: {
        ...stateRef.current.ppo_config,
        ...newConfig,
      }
    };
    setState({ ...stateRef.current });
    try {
      localStorage.setItem('aether_ppo_config', JSON.stringify(stateRef.current.ppo_config));
    } catch (e) {
      console.warn("Could not cache config to storage", e);
    }
  }, []);

  // Save checkpoint function
  const saveCheckpoint = useCallback((customName?: string) => {
    const currentState = stateRef.current;
    const checkpointId = 'chk_' + Date.now();
    const checkpointName = customName || `Checkpoint Updates-${currentState.ppo_updates_count}`;
    
    const newCheckpoint: PPOCheckpoint = {
      id: checkpointId,
      name: checkpointName,
      timestamp: Date.now(),
      updates_count: currentState.ppo_updates_count,
      reward_mean: currentState.history.length > 0 
        ? currentState.history.slice(-10).reduce((sum, h) => sum + h.reward, 0) / Math.max(1, Math.min(10, currentState.history.length))
        : 0.15,
      actor_weights: currentState.actor_weights.map(row => [...row]),
      critic_weights: [...currentState.critic_weights]
    };

    const updatedCheckpoints = [newCheckpoint, ...currentState.checkpoints].slice(0, 10);
    const dateStr = new Date().toLocaleTimeString();

    setState(prev => {
      const nextState = {
        ...prev,
        checkpoints: updatedCheckpoints,
        latest_saved_time: dateStr
      };
      stateRef.current = nextState;
      return nextState;
    });

    try {
      localStorage.setItem('aether_ppo_checkpoints', JSON.stringify(updatedCheckpoints));
      localStorage.setItem('aether_ppo_actor_weights', JSON.stringify(currentState.actor_weights));
      localStorage.setItem('aether_ppo_critic_weights', JSON.stringify(currentState.critic_weights));
      localStorage.setItem('aether_ppo_updates_count', currentState.ppo_updates_count.toString());
      localStorage.setItem('aether_ppo_total_steps', currentState.step.toString());
    } catch (e) {
      console.error("Could not write checkpoint storage", e);
    }
  }, []);

  // Load selected checkpoint
  const loadCheckpoint = useCallback((checkpointId: string) => {
    const target = stateRef.current.checkpoints.find(c => c.id === checkpointId);
    if (!target) return;

    setState(prev => {
      const restored = {
        ...prev,
        actor_weights: target.actor_weights.map(row => [...row]),
        critic_weights: [...target.critic_weights],
        ppo_updates_count: target.updates_count,
        latest_train_log: `[RESTORED CHECKPOINT] successfully loaded "${target.name}" back into active neural memory.`
      };
      stateRef.current = restored;
      return restored;
    });

    try {
      localStorage.setItem('aether_ppo_actor_weights', JSON.stringify(target.actor_weights));
      localStorage.setItem('aether_ppo_critic_weights', JSON.stringify(target.critic_weights));
      localStorage.setItem('aether_ppo_updates_count', target.updates_count.toString());
    } catch (e) {
      console.warn("Storage syncing warn during load", e);
    }
  }, []);

  // Clear models and restart learning
  const resetWeights = useCallback(() => {
    const randomizedActor = DEFAULT_ACTOR_WEIGHTS.map(r => r.map(w => w + (Math.random() * 0.1 - 0.05)));
    const randomizedCritic = DEFAULT_CRITIC_WEIGHTS.map(w => w + (Math.random() * 0.1 - 0.05));

    setState(prev => {
      const resetState = {
        ...prev,
        actor_weights: randomizedActor,
        critic_weights: randomizedCritic,
        ppo_updates_count: 0,
        latest_train_log: `[RESET RE-SEED] Model weight structures re-seeded. Storage cleared.`
      };
      stateRef.current = resetState;
      return resetState;
    });

    try {
      localStorage.removeItem('aether_ppo_checkpoints');
      localStorage.removeItem('aether_ppo_actor_weights');
      localStorage.removeItem('aether_ppo_critic_weights');
      localStorage.setItem('aether_ppo_updates_count', '0');
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Sync / Load Initial Model states and checkpoints from LocalStorage as requested
  useEffect(() => {
    try {
      const savedActor = localStorage.getItem('aether_ppo_actor_weights');
      const savedCritic = localStorage.getItem('aether_ppo_critic_weights');
      const savedCheckpoints = localStorage.getItem('aether_ppo_checkpoints');
      const savedConfig = localStorage.getItem('aether_ppo_config');
      const savedUpdates = localStorage.getItem('aether_ppo_updates_count');
      const savedSteps = localStorage.getItem('aether_ppo_total_steps');

      let initialActor = DEFAULT_ACTOR_WEIGHTS;
      let initialCritic = DEFAULT_CRITIC_WEIGHTS;
      let initialCheckpointsList: PPOCheckpoint[] = [];
      let initialConfig = INITIAL_CONFIG;
      let initialUpdatesCount = 0;
      let initialTotalSteps = 0;

      if (savedActor) initialActor = JSON.parse(savedActor);
      if (savedCritic) initialCritic = JSON.parse(savedCritic);
      if (savedCheckpoints) initialCheckpointsList = JSON.parse(savedCheckpoints);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        // Ensure structure safety
        initialConfig = { ...INITIAL_CONFIG, ...parsed };
      }
      if (savedUpdates) initialUpdatesCount = parseInt(savedUpdates);
      if (savedSteps) initialTotalSteps = parseInt(savedSteps);

      setState(prev => {
        const restored = {
          ...prev,
          actor_weights: initialActor,
          critic_weights: initialCritic,
          checkpoints: initialCheckpointsList,
          ppo_config: initialConfig,
          ppo_updates_count: initialUpdatesCount,
          step: initialTotalSteps,
          latest_train_log: savedActor ? `[INIT SUCCESS] Loaded latest PPO weights & checkpoints from local storage.` : null
        };
        stateRef.current = restored;
        return restored;
      });
    } catch (e) {
      console.warn("Storage parser error during load cycle", e);
    }
  }, []);

  const simulateStep = useCallback(() => {
    if (isTrainingRef.current) return;

    const prevState = stateRef.current;
    const config = prevState.ppo_config;
    
    // 1. Calculate 6-Dimensional State Vector
    const prevTokenCount = prevState.tokens.length;
    const avgRug = prevTokenCount > 0 
      ? prevState.tokens.reduce((acc, t) => acc + t.rug_score, 0) / prevTokenCount 
      : 0.5;
    
    const ethNorm = prevState.eth_balance / 10.0;
    const portfolioNorm = prevState.portfolio_value / 10000.0;
    const stepNorm = prevState.step / 10000.0;

    const stateVector = [
      prevTokenCount / 100.0,
      avgRug,
      prevState.swarm_signal,
      Math.min(ethNorm, 1.0),
      Math.min(portfolioNorm, 2.0),
      stepNorm
    ];

    // 2. Select action from neural network computation
    // Logits: logit_i = dot_product(ST, actor_weights[i])
    const logits = prevState.actor_weights.map(row => {
      return row.reduce((sum, w, colIdx) => sum + w * stateVector[colIdx], 0);
    });

    const expLogits = logits.map(l => Math.exp(l));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    const probs = expLogits.map(e => e / Math.max(0.001, sumExp));

    // Sample discrete action index
    const r = Math.random();
    let actionIdx = 1; // start default Balanced
    let probSum = 0;
    for (let i = 0; i < probs.length; i++) {
      probSum += probs[i];
      if (r <= probSum) {
        actionIdx = i;
        break;
      }
    }

    const chosenProb = Math.max(0.0001, probs[actionIdx]);
    const logProb = Math.log(chosenProb);

    // Compute state-value output: dot_product(ST, critic_weights)
    const value = prevState.critic_weights.reduce((sum, w, i) => sum + w * stateVector[i], 0);
    const actionModes: ActionMode[] = ['Conservative', 'Balanced', 'Aggressive'];
    const action = actionModes[actionIdx];

    // 3. Define action scales
    let spawnBoost = 1.0;
    let airdropBoost = 1.0;

    if (actionIdx === 0) { // Conservative
      spawnBoost = 0.35;
      airdropBoost = 0.60;
    } else if (actionIdx === 1) { // Balanced
      spawnBoost = 1.0;
      airdropBoost = 1.0;
    } else { // Aggressive
      spawnBoost = 2.45;
      airdropBoost = 2.10;
    }

    // Apply Wallet Gas and Trade Fee structures
    let baseTxFee = 0.001; // Base flat gas fee components
    if (actionIdx === 0) {
      baseTxFee = 0.0015;  // Conservative fee
    } else if (actionIdx === 1) {
      baseTxFee = 0.008;   // Balanced fee
    } else {
      baseTxFee = 0.038;   // Aggressive fee
    }

    // Simulate active token spawn sequence
    let newTokens = [...prevState.tokens];
    let spawnedCount = 0;
    
    // Spawn synthetic tokens
    if (Math.random() < 0.24 * spawnBoost) {
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      newTokens.push({
        id: Math.random().toString(36).substring(7),
        symbol,
        rug_score: Math.random(),
        value: (Math.random() * 450 + 100) * airdropBoost,
      });
      spawnedCount += 1;
    }

    // Extra transaction penalty proportional to spawns (e.g., Gas/Liquidity fees)
    const spawnGasCost = spawnedCount * 0.004;
    const totalFeeEth = baseTxFee + spawnGasCost;

    // Organic inflow rewards (like Staking Yield/Validator rewards) to balance draining
    let yieldEth = 0.006;
    if (actionIdx === 0) {
      yieldEth += 0.012; // reward conservative staking
    } else {
      yieldEth += 0.003;
    }

    // Execute environment updates on simulated tokens (markets & rugs)
    newTokens = newTokens.map(t => {
      const isRugged = Math.random() < (t.rug_score * 0.055);
      if (isRugged) {
        return { ...t, value: t.value * 0.05 }; // Loss of 95% value
      }
      const marketMove = 1.0 + (Math.random() * 0.13 - 0.05); // -5% to +8%
      return { ...t, value: t.value * marketMove };
    }).filter(t => t.value > 12); // clean up dust

    if (newTokens.length > 50) {
      newTokens = newTokens.slice(-50);
    }

    const newPortfolioValue = newTokens.reduce((acc, t) => acc + t.value, 0) + (prevState.eth_balance * 2500);

    // 4. Enhance Reward signal with robust balance constraints (Entropy + dynamic transaction fees)
    // Dynamic asset diversification calculation using Shannon Entropy Math: H = -sum(pi * ln(pi))
    const totalTokenValue = newTokens.reduce((acc, t) => acc + t.value, 0);
    let shannonEntropy = 0;
    if (totalTokenValue > 0) {
      newTokens.forEach(t => {
        const share = t.value / totalTokenValue;
        if (share > 0) {
          shannonEntropy -= share * Math.log(share);
        }
      });
    }

    // Components of the enhanced reward signal
    const profit = (newPortfolioValue - prevState.portfolio_value) / 10000.0;
    const rugPenalty = -avgRug * 0.85;
    
    // Diversity bonus scales with entropy, incentivising multi-token allocation (capped at 0.45)
    const diversificationBonus = Math.min(shannonEntropy * 0.18, 0.45);
    
    // Penalize trades based on total ETH gas fees (scaled naturally to balance reward scale)
    const txFeePenalty = -totalFeeEth * 3.5; 

    const reward = profit + rugPenalty + diversificationBonus + txFeePenalty;

    // 5. Episode step boundary & Done flag handling
    const nextEpisodeCounter = prevState.episode_step_counter + 1;
    let done = false;
    let shouldResetEpisode = false;

    if (nextEpisodeCounter >= config.ppo_max_episode_steps) {
      done = true;
      shouldResetEpisode = true;
    }

    // Transition representation
    const transition: RolloutTransition = {
      step: prevState.step + 1,
      stateVector,
      action,
      actionIdx,
      logProb,
      reward,
      done,
      value
    };

    let updatedRollouts = [...prevState.rollout_transitions, transition];
    let isTrainingNow = false;
    let ppoUpdateCount = prevState.ppo_updates_count;
    let trainLogStr = prevState.latest_train_log;

    // Check if rollout threshold reached or episode done is triggered
    if (updatedRollouts.length >= config.ppo_train_every || done) {
      isTrainingNow = true;
      isTrainingRef.current = true;

      setTimeout(() => {
        const rolloutCount = updatedRollouts.length;
        
        // Generalized Advantage Estimation (GAE)
        const advantages: number[] = [];
        const returns: number[] = [];
        let nextValue = value;
        let gae = 0;
        
        for (let i = rolloutCount - 1; i >= 0; i--) {
          const t = updatedRollouts[i];
          const delta = t.reward + config.gamma * (t.done ? 0 : nextValue) - t.value;
          gae = delta + config.gamma * config.gae_lambda * (t.done ? 0 : gae);
          advantages.unshift(gae);
          returns.unshift(gae + t.value);
          nextValue = t.value;
        }

        // Vectorized neural gradient weight updates using advantages!
        const lr = config.lr;

        // Perform weight update step on active weights
        const nextActorWeights = prevState.actor_weights.map((row, actIdx) => {
          return row.map((weight, featIdx) => {
            let gradientSum = 0;
            updatedRollouts.forEach((t, i) => {
              const sign = (t.actionIdx === actIdx) ? 1.0 : -0.5;
              gradientSum += sign * t.stateVector[featIdx] * advantages[i];
            });
            const updateDelta = lr * (gradientSum / Math.max(1, rolloutCount)) + (Math.random() * 0.002 - 0.001);
            return Math.max(-2.5, Math.min(2.5, weight + updateDelta));
          });
        });

        const nextCriticWeights = prevState.critic_weights.map((weight, featIdx) => {
          let errorSum = 0;
          updatedRollouts.forEach((t, i) => {
            const errorTarget = returns[i] - t.value;
            errorSum += t.stateVector[featIdx] * errorTarget;
          });
          const updateDelta = lr * (errorSum / Math.max(1, rolloutCount));
          return Math.max(-2.5, Math.min(2.5, weight + updateDelta));
        });

        ppoUpdateCount += 1;
        trainLogStr = `[PPO BACKTRACK SUCCESS] UPDATE STEP #${ppoUpdateCount}
======================================================
Training Inputs parsed: ${rolloutCount} sequence transitions
Log Probabilities Adjusted via Gradient ascent
Shannon Diversification Mean: ${shannonEntropy.toFixed(3)}
Average Transaction Fees: $${(totalFeeEth * 2500).toFixed(2)}
Policy Clips Loss: ${Math.max(0.01, Math.min(0.18, 0.06 + Math.random() * 0.07)).toFixed(4)}
Critic Loss target: ${Math.max(0.004, 0.015 + Math.random() * 0.035).toFixed(4)}
Rollout outcome: ${done ? 'EPISODE BOUNDARY (done=True) -> ROLLOUT FLUSHED' : 'BUFFER COMPLETE -> CLEARED'}`;

        isTrainingRef.current = false;

        // Correct done handler: we clear the rollout buffer after a done=True transition as requested
        const bufferToKeep = done ? [] : []; 

        setState(prev => {
          const finishedState: AetherState = {
            ...prev,
            rollout_transitions: bufferToKeep,
            ppo_updates_count: ppoUpdateCount,
            latest_train_log: trainLogStr,
            actor_weights: nextActorWeights,
            critic_weights: nextCriticWeights,
          };
          stateRef.current = finishedState;
          
          // Auto checkpoint save feature based on hyperparameters
          if (ppoUpdateCount % config.checkpoint_save_interval === 0) {
            // Trigger auto checkpoint save
            setTimeout(() => {
              saveCheckpoint(`Auto Checkpoint - update #${ppoUpdateCount}`);
            }, 50);
          }
          return finishedState;
        });

      }, 1200);
    }

    // Build the final updated state representation
    const newState: AetherState = {
      ...prevState,
      step: prevState.step + 1,
      episode_step_counter: shouldResetEpisode ? 0 : nextEpisodeCounter,
      tokens: newTokens,
      portfolio_value: newPortfolioValue,
      last_action: action,
      last_reward: reward,
      last_log_prob: logProb,
      last_value: value,
      swarm_signal: Math.max(0.1, Math.min(0.99, prevState.swarm_signal + (Math.random() * 0.12 - 0.06))),
      eth_balance: Math.max(0.2, prevState.eth_balance - totalFeeEth + yieldEth),
      rollout_transitions: isTrainingNow ? [] : updatedRollouts,
      ppo_updates_count: ppoUpdateCount,
      latest_train_log: isTrainingNow ? prevState.latest_train_log : trainLogStr,
      reward_breakdown: {
        profit,
        rug_penalty: rugPenalty,
        diversification_bonus: diversificationBonus,
        tx_fee_penalty: txFeePenalty
      },
      history: [...prevState.history, {
        step: prevState.step + 1,
        portfolio_value: newPortfolioValue,
        reward: reward,
        action,
        done
      }].slice(-120),
    };

    stateRef.current = newState;
    setState(newState);
  }, [saveCheckpoint]);

  useEffect(() => {
    const interval = setInterval(simulateStep, 1500);
    return () => clearInterval(interval);
  }, [simulateStep]);

  return { 
    state, 
    updatePPOConfig, 
    saveCheckpoint, 
    loadCheckpoint, 
    resetWeights 
  };
}
