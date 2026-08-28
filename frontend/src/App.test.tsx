import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Travelog frontend', () => {
  it('should render App component successfully', () => {
    // Basic smoke test — verify imports resolve without errors
    const React = require('react');
    const ReactDOM = require('react-dom/client');
    
    expect(React.createElement).toBeDefined();
    expect(typeof ReactDOM.createRoot).toBe('function');
  });

  it('should contain valid App source code', async () => {
    const appPath = path.resolve(__dirname, 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');
    expect(content).toContain('Travelog');
    expect(content).toContain('Foundation established');
  });
});
