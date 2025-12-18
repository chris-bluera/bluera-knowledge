/**
 * Default repositories for quick setup.
 * These are Anthropic/Claude-related repositories that provide
 * useful knowledge for Claude Code development.
 */

export interface DefaultRepo {
  /** Git URL for cloning */
  url: string;
  /** Friendly name for the store */
  name: string;
  /** Description of what this repo contains */
  description: string;
  /** Tags for categorization */
  tags: string[];
}

export const DEFAULT_REPOS: readonly DefaultRepo[] = [
  {
    url: 'git@github.com:ericbuess/claude-code-docs.git',
    name: 'claude-code-docs',
    description: 'Claude Code documentation',
    tags: ['claude', 'docs', 'claude-code'],
  },
  {
    url: 'git@github.com:anthropics/claude-code.git',
    name: 'claude-code',
    description: 'Claude Code CLI tool source',
    tags: ['claude', 'cli', 'anthropic'],
  },
  {
    url: 'git@github.com:anthropics/claude-agent-sdk-python.git',
    name: 'agent-sdk-python',
    description: 'Claude Agent SDK for Python',
    tags: ['claude', 'sdk', 'python', 'agents'],
  },
  {
    url: 'git@github.com:anthropics/skills.git',
    name: 'skills',
    description: 'Claude skills and capabilities',
    tags: ['claude', 'skills'],
  },
  {
    url: 'git@github.com:anthropics/claude-quickstarts.git',
    name: 'claude-quickstarts',
    description: 'Claude quickstart examples and tutorials',
    tags: ['claude', 'examples', 'tutorials'],
  },
  {
    url: 'git@github.com:anthropics/claude-plugins-official.git',
    name: 'claude-plugins',
    description: 'Official Claude plugins',
    tags: ['claude', 'plugins'],
  },
  {
    url: 'git@github.com:anthropics/claude-agent-sdk-typescript.git',
    name: 'agent-sdk-typescript',
    description: 'Claude Agent SDK for TypeScript',
    tags: ['claude', 'sdk', 'typescript', 'agents'],
  },
  {
    url: 'git@github.com:anthropics/claude-agent-sdk-demos.git',
    name: 'agent-sdk-demos',
    description: 'Claude Agent SDK demo applications',
    tags: ['claude', 'sdk', 'demos', 'examples'],
  },
];
