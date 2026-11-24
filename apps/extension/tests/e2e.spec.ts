import { test, expect } from '@playwright/test';
import path from 'path';

const WEB_DIR = path.resolve(import.meta.dirname || process.cwd(), '../../web/public');

test.describe('Recare End-to-End Test Bench Verifications', () => {

  test('E2E Scenario 1: Form page analysis and filling', async ({ page }) => {
    const formUrl = `file://${path.join(WEB_DIR, 'form.html')}`;
    await page.goto(formUrl);

    // Verify headings
    const h1Text = await page.locator('h1').textContent();
    expect(h1Text).toContain('Create New Invoice');

    // Fill form elements
    await page.fill('#client-name', 'Wayne Enterprises');
    await page.fill('#invoice-amount', '4200');
    await page.selectOption('#currency-select', 'EUR');
    await page.fill('#invoice-notes', 'Security system audit and consulting');

    // Submit form
    await page.click('#btn-submit-invoice');

    // Verify success notice is displayed
    const notice = page.locator('#success-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Invoice was created successfully');
  });

  test('E2E Scenario 2: Navigation, tabs, and control highlighting', async ({ page }) => {
    const navUrl = `file://${path.join(WEB_DIR, 'navigation.html')}`;
    await page.goto(navUrl);

    // Initial tab check
    await expect(page.locator('#panel-0')).toBeVisible();
    await expect(page.locator('#panel-1')).not.toBeVisible();

    // Click Transactions tab
    await page.click('button:has-text("Transactions")');
    await expect(page.locator('#panel-1')).toBeVisible();
    await expect(page.locator('#panel-0')).not.toBeVisible();
  });

  test('E2E Scenario 3: Multi-step checkout with consequential payment', async ({ page }) => {
    const workflowUrl = `file://${path.join(WEB_DIR, 'workflow.html')}`;
    await page.goto(workflowUrl);

    // Step 1: Details
    await page.fill('#org-name', 'Cyberdyne Systems');
    await page.click('#btn-goto-step-2');

    // Step 2: Review (Consequential step before payment)
    const reviewStep = page.locator('#step-2');
    await expect(reviewStep).toBeVisible();
    const payBtn = page.locator('#btn-confirm-order');
    await expect(payBtn).toBeVisible();
    await expect(payBtn).toContainText('Confirm and Pay $99');

    // Complete payment
    await payBtn.click();

    // Step 3: Verified completion
    const completeStep = page.locator('#step-3');
    await expect(completeStep).toBeVisible();
    await expect(completeStep).toContainText('Your subscription has been activated successfully');
  });

  test('E2E Scenario 4: Dynamic single-page application mutations', async ({ page }) => {
    const dynamicUrl = `file://${path.join(WEB_DIR, 'dynamic.html')}`;
    await page.goto(dynamicUrl);

    // Add a new dynamic item
    await page.fill('#task-input', 'Verify WCAG 2.2 AA Contrast');
    await page.click('#btn-add-task');

    // Verify item was rendered into the DOM
    const newItem = page.locator('#task-list').getByText('Verify WCAG 2.2 AA Contrast');
    await expect(newItem).toBeVisible();
  });

  test('E2E Scenario 5: Inaccessible div-based elements interaction', async ({ page }) => {
    const inaccUrl = `file://${path.join(WEB_DIR, 'inaccessible.html')}`;
    await page.goto(inaccUrl);

    // Locate pseudo-button
    const fakeBtn = page.locator('.fake-button');
    await expect(fakeBtn).toBeVisible();
    await expect(fakeBtn).toContainText('Generate Export File');
  });

  test('E2E Scenario 6: Prompt injection containment', async ({ page }) => {
    const injectionUrl = `file://${path.join(WEB_DIR, 'injection.html')}`;
    await page.goto(injectionUrl);

    // Verify page content exists
    const title = await page.locator('h1').textContent();
    expect(title).toContain('Document Summary Page');

    // Dangerous button exists on page
    const delBtn = page.locator('#btn-delete');
    await expect(delBtn).toBeVisible();
    await expect(delBtn).toContainText('Delete Database');
  });

});
