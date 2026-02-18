/**
 * Voice Campaign Optimizer
 * Kernel module for optimizing voice campaigns based on call outcomes
 * 
 * Implements rules-based optimization:
 * - Stop-loss if failure rate is high
 * - Adjust retry windows based on outcomes
 * - Choose best agent/script variant by connect->qualified rate
 */

export interface VoiceCampaignMetrics {
  campaignId: string;
  totalCalls: number;
  completedCalls: number;
  connectedCalls: number;
  qualifiedCalls: number;
  noAnswerCalls: number;
  busyCalls: number;
  failedCalls: number;
  avgDurationSeconds: number;
  avgCostPerCall: number;
  connectRate: number; // completed / total
  qualificationRate: number; // qualified / connected
  efficiency: number; // qualified / total
}

export interface OptimizationDecision {
  decision_type: 'pause_campaign' | 'adjust_retry_window' | 'switch_agent' | 'continue' | 'scale_up';
  reason: string;
  action: string;
  metadata: Record<string, any>;
}

/**
 * Analyze campaign performance and make optimization decisions
 */
export async function optimizeVoiceCampaign(
  campaignId: string,
  supabaseClient: any
): Promise<OptimizationDecision> {
  // 1. Fetch campaign metrics
  const metrics = await calculateCampaignMetrics(campaignId, supabaseClient);
  
  // 2. Apply optimization rules
  const decision = applyOptimizationRules(metrics);
  
  // 3. Persist decision
  await persistDecision(campaignId, decision, supabaseClient);
  
  // 4. Execute action (if needed)
  if (decision.decision_type !== 'continue') {
    await executeOptimizationAction(campaignId, decision, supabaseClient);
  }
  
  return decision;
}

/**
 * Calculate campaign metrics from call records
 */
async function calculateCampaignMetrics(
  campaignId: string,
  supabaseClient: any
): Promise<VoiceCampaignMetrics> {
  const { data: calls, error } = await supabaseClient
    .from('voice_call_records')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error || !calls) {
    throw new Error(`Failed to fetch call records: ${error?.message}`);
  }

  const totalCalls = calls.length;
  const completedCalls = calls.filter((c: any) => c.status === 'completed').length;
  const connectedCalls = calls.filter((c: any) => 
    c.status === 'completed' && c.outcome === 'connected'
  ).length;
  const qualifiedCalls = calls.filter((c: any) => 
    c.outcome === 'qualified' || c.analysis?.qualification_score >= 7
  ).length;
  const noAnswerCalls = calls.filter((c: any) => 
    c.status === 'no-answer' || c.outcome === 'no-answer'
  ).length;
  const busyCalls = calls.filter((c: any) => 
    c.status === 'busy' || c.outcome === 'busy'
  ).length;
  const failedCalls = calls.filter((c: any) => c.status === 'failed').length;

  const totalDuration = calls.reduce((sum: number, c: any) => 
    sum + (c.duration_seconds || 0), 0
  );
  const totalCost = calls.reduce((sum: number, c: any) => 
    sum + (c.cost || 0), 0
  );

  const avgDurationSeconds = totalCalls > 0 ? totalDuration / totalCalls : 0;
  const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
  const connectRate = totalCalls > 0 ? connectedCalls / totalCalls : 0;
  const qualificationRate = connectedCalls > 0 ? qualifiedCalls / connectedCalls : 0;
  const efficiency = totalCalls > 0 ? qualifiedCalls / totalCalls : 0;

  return {
    campaignId,
    totalCalls,
    completedCalls,
    connectedCalls,
    qualifiedCalls,
    noAnswerCalls,
    busyCalls,
    failedCalls,
    avgDurationSeconds,
    avgCostPerCall,
    connectRate,
    qualificationRate,
    efficiency,
  };
}

/**
 * Apply optimization rules based on metrics
 */
function applyOptimizationRules(metrics: VoiceCampaignMetrics): OptimizationDecision {
  // Rule 1: Stop-loss - High failure rate (>30%)
  const failureRate = metrics.totalCalls > 0 ? metrics.failedCalls / metrics.totalCalls : 0;
  if (metrics.totalCalls >= 10 && failureRate > 0.3) {
    return {
      decision_type: 'pause_campaign',
      reason: `High failure rate detected: ${(failureRate * 100).toFixed(1)}% (threshold: 30%)`,
      action: 'pause_campaign',
      metadata: {
        failure_rate: failureRate,
        failed_calls: metrics.failedCalls,
        total_calls: metrics.totalCalls,
      },
    };
  }

  // Rule 2: Poor connect rate (<20%) - Adjust retry window
  if (metrics.totalCalls >= 20 && metrics.connectRate < 0.2) {
    return {
      decision_type: 'adjust_retry_window',
      reason: `Low connect rate: ${(metrics.connectRate * 100).toFixed(1)}% (threshold: 20%)`,
      action: 'shift_calling_hours',
      metadata: {
        connect_rate: metrics.connectRate,
        no_answer_calls: metrics.noAnswerCalls,
        recommendation: 'Try different time windows (e.g., 10am-12pm, 2pm-4pm)',
      },
    };
  }

  // Rule 3: Poor qualification rate (<15%) - Switch agent/script
  if (metrics.connectedCalls >= 10 && metrics.qualificationRate < 0.15) {
    return {
      decision_type: 'switch_agent',
      reason: `Low qualification rate: ${(metrics.qualificationRate * 100).toFixed(1)}% (threshold: 15%)`,
      action: 'test_new_script',
      metadata: {
        qualification_rate: metrics.qualificationRate,
        connected_calls: metrics.connectedCalls,
        qualified_calls: metrics.qualifiedCalls,
        recommendation: 'Consider testing alternative agent script or adjusting qualification criteria',
      },
    };
  }

  // Rule 4: High efficiency (>30%) - Scale up
  if (metrics.totalCalls >= 50 && metrics.efficiency > 0.3 && metrics.connectRate > 0.4) {
    return {
      decision_type: 'scale_up',
      reason: `High efficiency detected: ${(metrics.efficiency * 100).toFixed(1)}% qualified rate`,
      action: 'increase_volume',
      metadata: {
        efficiency: metrics.efficiency,
        connect_rate: metrics.connectRate,
        qualification_rate: metrics.qualificationRate,
        recommendation: 'Campaign performing well - consider increasing call volume',
      },
    };
  }

  // Default: Continue as-is
  return {
    decision_type: 'continue',
    reason: 'Campaign metrics within acceptable range',
    action: 'monitor',
    metadata: {
      efficiency: metrics.efficiency,
      connect_rate: metrics.connectRate,
      qualification_rate: metrics.qualificationRate,
    },
  };
}

/**
 * Persist optimization decision to kernel_decisions
 */
async function persistDecision(
  campaignId: string,
  decision: OptimizationDecision,
  supabaseClient: any
): Promise<void> {
  // Get campaign details for tenant_id
  const { data: campaign } = await supabaseClient
    .from('voice_campaigns')
    .select('tenant_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    console.warn(`Campaign not found: ${campaignId}`);
    return;
  }

  // Create kernel event first
  const { data: kernelEvent } = await supabaseClient
    .from('kernel_events')
    .insert({
      tenant_id: campaign.tenant_id,
      type: 'voice.campaign.optimization_analyzed',
      source: 'voice_optimizer',
      entity_type: 'campaign',
      entity_id: campaignId,
      correlation_id: `voice_opt_${campaignId}_${Date.now()}`,
      payload_json: {
        decision_type: decision.decision_type,
        reason: decision.reason,
        metadata: decision.metadata,
      },
      occurred_at: new Date().toISOString(),
      idempotency_key: `voice_opt_${campaignId}_${Date.now()}`,
    })
    .select('id')
    .single();

  if (!kernelEvent) {
    console.error('Failed to create kernel event');
    return;
  }

  // Create kernel decision
  await supabaseClient
    .from('kernel_decisions')
    .insert({
      tenant_id: campaign.tenant_id,
      event_id: kernelEvent.id,
      correlation_id: kernelEvent.correlation_id,
      policy_name: 'voice_campaign_optimization',
      decision_type: decision.decision_type,
      decision_json: {
        campaign_id: campaignId,
        decision: decision.decision_type,
        reason: decision.reason,
        action: decision.action,
        metadata: decision.metadata,
      },
      status: 'proposed',
    });
}

/**
 * Execute optimization action
 */
async function executeOptimizationAction(
  campaignId: string,
  decision: OptimizationDecision,
  supabaseClient: any
): Promise<void> {
  switch (decision.decision_type) {
    case 'pause_campaign':
      // Pause the campaign
      await supabaseClient
        .from('voice_campaigns')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
      console.log(`✋ Campaign ${campaignId} paused due to: ${decision.reason}`);
      break;

    case 'adjust_retry_window':
      // Update call schedule in campaign config
      const { data: campaign } = await supabaseClient
        .from('voice_campaigns')
        .select('call_schedule')
        .eq('id', campaignId)
        .single();

      const currentSchedule = campaign?.call_schedule || {};
      const newSchedule = {
        ...currentSchedule,
        retry_windows: [
          { start: '10:00', end: '12:00', timezone: 'local' },
          { start: '14:00', end: '16:00', timezone: 'local' },
        ],
        optimization_applied_at: new Date().toISOString(),
      };

      await supabaseClient
        .from('voice_campaigns')
        .update({
          call_schedule: newSchedule,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
      console.log(`⏰ Campaign ${campaignId} retry windows adjusted`);
      break;

    case 'switch_agent':
      // Log recommendation - actual agent switch requires manual intervention
      console.log(`💡 Campaign ${campaignId} recommendation: ${decision.metadata.recommendation}`);
      break;

    case 'scale_up':
      // Log recommendation - scaling requires manual intervention
      console.log(`📈 Campaign ${campaignId} performing well - consider scaling up`);
      break;

    default:
      console.log(`✓ Campaign ${campaignId} continuing with no changes`);
  }

  // Create kernel action record
  const { data: latestDecision } = await supabaseClient
    .from('kernel_decisions')
    .select('id, tenant_id, correlation_id')
    .eq('decision_json->>campaign_id', campaignId)
    .eq('policy_name', 'voice_campaign_optimization')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestDecision) {
    await supabaseClient
      .from('kernel_actions')
      .insert({
        tenant_id: latestDecision.tenant_id,
        decision_id: latestDecision.id,
        correlation_id: latestDecision.correlation_id,
        action_type: decision.action,
        action_json: {
          campaign_id: campaignId,
          decision: decision.decision_type,
          executed_action: decision.action,
          metadata: decision.metadata,
        },
        status: 'executed',
        executed_at: new Date().toISOString(),
      });
  }
}

/**
 * Entry point for kernel optimizer
 * Called by edge functions after post-call webhook processing
 */
export async function runVoiceOptimization(
  campaignId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<OptimizationDecision> {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  
  return await optimizeVoiceCampaign(campaignId, supabaseClient);
}
