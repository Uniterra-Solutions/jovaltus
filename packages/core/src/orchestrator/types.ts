import type { JovaltusConfig } from '../config/types.js';

export type PhaseName = 'implementation' | 'planning' | 'verification' | 'simplification';

export interface VerificationItem {
  readonly description: string;
  readonly command: string;
}

export interface CheckPlan {
  readonly taskSummary: string;
  readonly implementationPlan: string;
  readonly acceptanceCriteria: readonly string[];
  readonly affectedModules: readonly string[];
  readonly verificationItems: readonly VerificationItem[];
}

export interface PhaseResult {
  readonly phase: PhaseName;
  readonly status: 'completed' | 'failed';
  readonly summary: string;
  readonly data?: unknown;
}

export interface AgentModeResult {
  readonly phases: readonly PhaseResult[];
  readonly simplifiedFiles: readonly string[];
  readonly finalSummary: string;
}

export interface AgentModeOptions {
  readonly repoPath: string;
  readonly config: JovaltusConfig;
  readonly implSystemPrompt?: string;
  readonly plannerSystemPrompt?: string;
  readonly simplifierSystemPrompt?: string;
  readonly verifierSystemPrompt?: string;
  readonly fixerSystemPrompt?: string;
}

export type AgentModeEvent =
  | { readonly type: 'phase_start'; readonly phase: PhaseName }
  | { readonly type: 'phase_end'; readonly phase: PhaseName; readonly result: PhaseResult }
  | { readonly type: 'stream_delta'; readonly phase: PhaseName; readonly text: string }
  | {
      readonly type: 'tool_call';
      readonly phase: PhaseName;
      readonly toolName: string;
      readonly args: unknown;
    }
  | {
      readonly type: 'tool_result';
      readonly phase: PhaseName;
      readonly toolName: string;
      readonly isError: boolean;
    }
  | { readonly type: 'error'; readonly phase: PhaseName; readonly message: string };
