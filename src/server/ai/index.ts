/**
 * AI Module
 * 
 * Provides Z.AI integration with configurable API key via Modelence Cloud.
 * Uses GLM-4.7-Flash model (lightweight, completely free).
 * 
 * API Docs: https://docs.z.ai/guides/develop/http/introduction.md
 * Model Docs: https://docs.z.ai/guides/llm/glm-4.7.md
 */

import { Module } from 'modelence/server';

export default new Module('ai', {
  configSchema: {
    apiKey: {
      type: 'string',
      isPublic: false,
      default: '',
    },
  },
});
