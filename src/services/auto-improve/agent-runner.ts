import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentRunner, AgentContext } from './orchestrator.js';
import type { AgentRecommendation, Change } from './types.js';

const CLAUDE_CLI = process.env['CLAUDE_CLI'] ?? `${process.env['HOME'] ?? ''}/.claude/local/claude`;

interface AgentPromptConfig {
  agentId: string;
  systemPrompt: string;
  targetFiles: string[];
}

/**
 * Production implementation of AgentRunner.
 * Spawns Claude agents in parallel to research improvements.
 */
export class ProductionAgentRunner implements AgentRunner {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async runAgents(context: AgentContext): Promise<AgentRecommendation[]> {
    const agents = this.createAgentConfigs(context);
    const recommendations: AgentRecommendation[] = [];

    console.log(`   Spawning ${String(agents.length)} agents: ${agents.map(a => a.agentId).join(', ')}`);

    // Run agents in parallel using Promise.all
    const results = await Promise.all(
      agents.map(agent => this.runAgent(agent, context))
    );

    let successCount = 0;
    for (const result of results) {
      if (result !== null) {
        recommendations.push(result);
        successCount++;
      }
    }

    console.log(`   Agents completed: ${String(successCount)}/${String(agents.length)} returned recommendations\n`);

    return recommendations;
  }

  private createAgentConfigs(context: AgentContext): AgentPromptConfig[] {
    return [
      {
        agentId: 'config-agent',
        systemPrompt: this.createConfigAgentPrompt(context),
        targetFiles: [
          'src/types/config.ts',
        ],
      },
      {
        agentId: 'ranking-agent',
        systemPrompt: this.createRankingAgentPrompt(context),
        targetFiles: [
          'src/services/search.service.ts',
        ],
      },
      {
        agentId: 'indexing-agent',
        systemPrompt: this.createIndexingAgentPrompt(context),
        targetFiles: [
          'src/services/chunking.service.ts',
          'src/services/index.service.ts',
        ],
      },
    ];
  }

  private async runAgent(
    config: AgentPromptConfig,
    context: AgentContext
  ): Promise<AgentRecommendation | null> {
    console.log(`     → Running ${config.agentId}...`);
    try {
      // Build file context
      const fileContents: string[] = [];
      for (const file of config.targetFiles) {
        const fullPath = join(this.projectRoot, file);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');
          fileContents.push(`=== ${file} ===\n${content}\n`);
        } else {
          console.log(`       Warning: ${file} not found`);
        }
      }

      const prompt = `${config.systemPrompt}

Current quality scores:
- Relevance: ${context.baselineScores.relevance.toFixed(3)}
- Ranking: ${context.baselineScores.ranking.toFixed(3)}
- Coverage: ${context.baselineScores.coverage.toFixed(3)}
- Snippet Quality: ${context.baselineScores.snippetQuality.toFixed(3)}
- Overall: ${context.baselineScores.overall.toFixed(3)}

Lowest scoring dimension: ${context.lowestDimension}
Focus dimension: ${context.focusDimension ?? context.lowestDimension}

Relevant source files:
${fileContents.join('\n')}

Respond with a JSON object containing:
{
  "confidence": <0-1 number>,
  "targetDimension": "<dimension to improve>",
  "changes": [
    {
      "type": "<config|code|reindex>",
      "priority": <1-10 number>,
      "file": "<relative file path>",
      "description": "<what this change does>",
      "before": "<exact text to find>",
      "after": "<replacement text>"
    }
  ],
  "reasoning": "<why these changes will improve scores>",
  "expectedImprovement": <0-0.1 number>
}`;

      const schema = JSON.stringify({
        type: 'object',
        properties: {
          confidence: { type: 'number' },
          targetDimension: { type: 'string' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['config', 'code', 'reindex'] },
                priority: { type: 'number' },
                file: { type: 'string' },
                description: { type: 'string' },
                before: { type: 'string' },
                after: { type: 'string' },
              },
              required: ['type', 'priority', 'file', 'description', 'before', 'after'],
            },
          },
          reasoning: { type: 'string' },
          expectedImprovement: { type: 'number' },
        },
        required: ['confidence', 'targetDimension', 'changes', 'reasoning', 'expectedImprovement'],
      });

      console.log(`       Calling Claude CLI (timeout: 120s)...`);
      const result = execSync(
        `${CLAUDE_CLI} -p ${this.shellEscape(prompt)} --output-format json --json-schema ${this.shellEscape(schema)}`,
        {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      console.log(`       Claude CLI response received (${String(result.length)} chars)`);

      const parsed = this.parseClaudeOutput(result);
      const response = parsed as {
        confidence: number;
        targetDimension: string;
        changes: Array<{
          type: 'config' | 'code' | 'reindex';
          priority: number;
          file: string;
          description: string;
          before: string;
          after: string;
        }>;
        reasoning: string;
        expectedImprovement: number;
      };

      // Convert relative paths to absolute
      const changes: Change[] = response.changes.map(c => ({
        ...c,
        file: join(this.projectRoot, c.file),
      }));

      return {
        agentId: config.agentId,
        confidence: response.confidence,
        targetDimension: response.targetDimension as keyof typeof context.baselineScores,
        changes,
        reasoning: response.reasoning,
        expectedImprovement: response.expectedImprovement,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Agent ${config.agentId} failed:`);
      console.error(`   ${errorMessage.split('\n')[0]}`);
      if (error instanceof Error && 'stderr' in error) {
        console.error(`   stderr: ${String((error as NodeJS.ErrnoException & { stderr?: string }).stderr).slice(0, 200)}`);
      }
      return null;
    }
  }

  private createConfigAgentPrompt(context: AgentContext): string {
    return `You are a search quality optimization expert analyzing configuration parameters.

Your task: Analyze the current configuration and propose changes to improve ${context.focusDimension ?? context.lowestDimension} scores.

Key parameters to consider:
- search.rrf.k: RRF constant (20-60), affects how vector and FTS scores are combined
- search.rrf.vectorWeight: Weight for vector similarity (0.3-0.7)
- search.rrf.ftsWeight: Weight for full-text search (0.3-0.7)
- indexing.chunkSize: Size of text chunks (256-2048)
- indexing.chunkOverlap: Overlap between chunks (25-200)

Think about:
- Larger chunks provide more context but may reduce precision
- Smaller chunks are more precise but may miss context
- RRF weights balance semantic vs keyword matching

Only propose changes you're confident will help. If you're unsure, set confidence lower.`;
  }

  private createRankingAgentPrompt(context: AgentContext): string {
    return `You are a search ranking optimization expert analyzing boost multipliers.

Your task: Analyze the current ranking logic and propose changes to improve ${context.focusDimension ?? context.lowestDimension} scores.

Key areas to examine in search.service.ts:
- Intent boost multipliers (lines ~19-70): Different intents get different boosts
- File type boosts (lines ~407-441): Some file types rank higher
- Framework context boosts (lines ~447-469): Framework-specific relevance

Think about:
- Are certain file types unfairly penalized or boosted?
- Do intent multipliers align with user expectations?
- Are framework boosts helping or hurting relevance?

Only propose small, targeted changes. Big changes are risky.`;
  }

  private createIndexingAgentPrompt(context: AgentContext): string {
    return `You are a search indexing optimization expert analyzing chunking strategies.

Your task: Analyze the current chunking approach and propose changes to improve ${context.focusDimension ?? context.lowestDimension} scores.

Key areas to examine:
- chunking.service.ts: How text is split into searchable chunks
- index.service.ts: How documents are processed and indexed

Think about:
- Should code files be chunked differently than markdown?
- Are function/class boundaries being respected?
- Is important metadata being preserved in chunks?

Be conservative. Changes to indexing require reindexing the entire corpus.`;
  }

  private shellEscape(str: string): string {
    return `'${str.replace(/'/g, "'\"'\"'")}'`;
  }

  private parseClaudeOutput(output: string): unknown {
    if (output === '' || output.trim() === '') {
      throw new Error('Claude CLI returned empty output');
    }

    let wrapper;
    try {
      wrapper = JSON.parse(output) as {
        result: string;
        is_error: boolean;
        structured_output?: unknown;
      };
    } catch {
      throw new Error('Failed to parse Claude CLI wrapper');
    }

    if (wrapper.is_error) {
      throw new Error(`Claude CLI error: ${wrapper.result}`);
    }

    if (wrapper.structured_output !== undefined) {
      return wrapper.structured_output;
    }

    // Try to extract JSON from result
    let result = wrapper.result;
    const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch !== null && codeBlockMatch[1] !== undefined) {
      result = codeBlockMatch[1].trim();
    }

    return JSON.parse(result) as unknown;
  }
}
