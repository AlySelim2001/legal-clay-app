/**
 * Agents Module — CRIM-SYS 2026
 *
 * Barrel export for the legal agents system.
 */

export { ADVANCED_AGENTS, getAdvancedAgentById, getAdvancedAgentsByDomain } from './advanced-agents';
export { SwarmOrchestrator, getSwarmOrchestrator } from './swarm-orchestrator';
export { LegalChatbot, getLegalChatbot } from './legal-chatbot';
export type { QueryClassification, MultiAgentAnalysis, SwarmConfig } from './swarm-orchestrator';
export type { ChatMessage, ChatSession, ChatbotResponse } from './legal-chatbot';
