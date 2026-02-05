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
