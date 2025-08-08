#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './components/App';

// Check for debug flag
const isDebugMode = process.argv.includes('--debug');
process.env.CLAUDE_CONDOM_DEBUG = isDebugMode ? 'true' : 'false';

if (isDebugMode) {
  console.log('[DEBUG MODE] Enabled - detailed logging active');
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Render the app
render(React.createElement(App));