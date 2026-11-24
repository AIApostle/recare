import { describe, it, expect, beforeEach } from 'vitest';
import { DomExtractor } from '../features/dom/extractor';
import { DomExecutor } from '../features/dom/executor';
import { BrowserAction } from '../types';

describe('DomExtractor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h1>Account Portal</h1>
      <h2>Quick Actions</h2>
      <button id="btn-1" aria-label="Create Invoice">Create</button>
      <a href="/settings">Settings</a>
      <label for="username">Username</label>
      <input type="text" id="username" value="johndoe" />
      <label for="password">Password</label>
      <input type="password" id="password" value="secret123" />
      <button disabled>Disabled Button</button>
    `;
  });

  it('extracts headings in document order', () => {
    const ctx = DomExtractor.extractPageContext();
    expect(ctx.headings).toHaveLength(2);
    expect(ctx.headings[0]).toEqual({ level: 1, text: 'Account Portal' });
    expect(ctx.headings[1]).toEqual({ level: 2, text: 'Quick Actions' });
  });

  it('extracts interactive elements and computes accessible names', () => {
    const ctx = DomExtractor.extractPageContext();
    const invoiceBtn = ctx.interactive_elements.find((e) => e.accessible_name === 'Create Invoice');
    expect(invoiceBtn).toBeDefined();
    expect(invoiceBtn?.tag).toBe('button');
    expect(invoiceBtn?.element_id).toMatch(/^elem_\d+$/);
  });

  it('sanitizes password values for privacy', () => {
    const ctx = DomExtractor.extractPageContext();
    const pwdInput = ctx.interactive_elements.find((e) => e.input_type === 'password');
    expect(pwdInput).toBeDefined();
    expect(pwdInput?.current_value).toBe('[PASSWORD_PROTECTED]');
  });
});

describe('DomExecutor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-target" data-recare-id="elem_1">Submit Application</button>
      <input id="input-target" data-recare-id="elem_2" type="text" value="" />
    `;
  });

  it('executes CLICK action on target element', async () => {
    let clicked = false;
    document.getElementById('btn-target')?.addEventListener('click', () => {
      clicked = true;
    });

    const action: BrowserAction = {
      action_id: 'act_1',
      type: 'CLICK',
      target: { element_id: 'elem_1' },
      reason: 'Click the submit button',
      requires_approval: false,
      risk_level: 'LOW',
    };

    const result = await DomExecutor.execute(action);
    expect(result.success).toBe(true);
    expect(clicked).toBe(true);
  });

  it('executes FILL action on target input', async () => {
    const action: BrowserAction = {
      action_id: 'act_2',
      type: 'FILL',
      target: { element_id: 'elem_2' },
      value: 'Antigravity Agent',
      reason: 'Fill the text field',
      requires_approval: false,
      risk_level: 'LOW',
    };

    const result = await DomExecutor.execute(action);
    expect(result.success).toBe(true);
    const input = document.getElementById('input-target') as HTMLInputElement;
    expect(input.value).toBe('Antigravity Agent');
  });

  it('returns failure when target element is not found', async () => {
    const action: BrowserAction = {
      action_id: 'act_3',
      type: 'CLICK',
      target: { element_id: 'elem_nonexistent' },
      reason: 'Click missing button',
      requires_approval: false,
      risk_level: 'LOW',
    };

    const result = await DomExecutor.execute(action);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
