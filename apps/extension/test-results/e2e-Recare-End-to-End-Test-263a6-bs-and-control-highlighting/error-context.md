# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.ts >> Recare End-to-End Test Bench Verifications >> E2E Scenario 2: Navigation, tabs, and control highlighting
- Location: tests/e2e.spec.ts:31:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).not.toBeVisible() failed

Locator: locator('#panel-1')
Expected: not visible
Error: Test timeout of 30000ms exceeded.

Call log:
  - Expect "not toBeVisible" locator('#panel-1') with timeout 5000ms
  - waiting for locator('#panel-1')
  - Test timeout of 30000ms exceeded.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "← Back to Test Bench" [ref=e2] [cursor=pointer]:
    - /url: index.html
  - heading "Navigation and Interactive Controls" [level=1] [ref=e3]
  - generic [ref=e4]:
    - button "Overview Tab" [ref=e5] [cursor=pointer]: Overview
    - button "Transactions Tab" [ref=e6] [cursor=pointer]: Transactions
    - button "Settings Tab" [ref=e7] [cursor=pointer]: Settings
  - generic [ref=e8]:
    - heading "Account Overview" [level=2] [ref=e9]
    - paragraph [ref=e10]: Your current account balance is $12,450.00.
    - button "Download Latest Statement" [ref=e11] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import path from 'path';
  3   | 
  4   | const WEB_DIR = path.resolve(import.meta.dirname || process.cwd(), '../../web/public');
  5   | 
  6   | test.describe('Recare End-to-End Test Bench Verifications', () => {
  7   | 
  8   |   test('E2E Scenario 1: Form page analysis and filling', async ({ page }) => {
  9   |     const formUrl = `file://${path.join(WEB_DIR, 'form.html')}`;
  10  |     await page.goto(formUrl);
  11  | 
  12  |     // Verify headings
  13  |     const h1Text = await page.locator('h1').textContent();
  14  |     expect(h1Text).toContain('Create New Invoice');
  15  | 
  16  |     // Fill form elements
  17  |     await page.fill('#client-name', 'Wayne Enterprises');
  18  |     await page.fill('#invoice-amount', '4200');
  19  |     await page.selectOption('#currency-select', 'EUR');
  20  |     await page.fill('#invoice-notes', 'Security system audit and consulting');
  21  | 
  22  |     // Submit form
  23  |     await page.click('#btn-submit-invoice');
  24  | 
  25  |     // Verify success notice is displayed
  26  |     const notice = page.locator('#success-notice');
  27  |     await expect(notice).toBeVisible();
  28  |     await expect(notice).toContainText('Invoice was created successfully');
  29  |   });
  30  | 
  31  |   test('E2E Scenario 2: Navigation, tabs, and control highlighting', async ({ page }) => {
  32  |     const navUrl = `file://${path.join(WEB_DIR, 'navigation.html')}`;
  33  |     await page.goto(navUrl);
  34  | 
  35  |     // Initial tab check
  36  |     await expect(page.locator('#panel-0')).toBeVisible();
> 37  |     await expect(page.locator('#panel-1')).not.toBeVisible();
      |                                                ^ Error: expect(locator).not.toBeVisible() failed
  38  | 
  39  |     // Click Transactions tab
  40  |     await page.click('button:has-text("Transactions")');
  41  |     await expect(page.locator('#panel-1')).toBeVisible();
  42  |     await expect(page.locator('#panel-0')).not.toBeVisible();
  43  |   });
  44  | 
  45  |   test('E2E Scenario 3: Multi-step checkout with consequential payment', async ({ page }) => {
  46  |     const workflowUrl = `file://${path.join(WEB_DIR, 'workflow.html')}`;
  47  |     await page.goto(workflowUrl);
  48  | 
  49  |     // Step 1: Details
  50  |     await page.fill('#org-name', 'Cyberdyne Systems');
  51  |     await page.click('#btn-goto-step-2');
  52  | 
  53  |     // Step 2: Review (Consequential step before payment)
  54  |     const reviewStep = page.locator('#step-2');
  55  |     await expect(reviewStep).toBeVisible();
  56  |     const payBtn = page.locator('#btn-confirm-order');
  57  |     await expect(payBtn).toBeVisible();
  58  |     await expect(payBtn).toContainText('Confirm and Pay $99');
  59  | 
  60  |     // Complete payment
  61  |     await payBtn.click();
  62  | 
  63  |     // Step 3: Verified completion
  64  |     const completeStep = page.locator('#step-3');
  65  |     await expect(completeStep).toBeVisible();
  66  |     await expect(completeStep).toContainText('Your subscription has been activated successfully');
  67  |   });
  68  | 
  69  |   test('E2E Scenario 4: Dynamic single-page application mutations', async ({ page }) => {
  70  |     const dynamicUrl = `file://${path.join(WEB_DIR, 'dynamic.html')}`;
  71  |     await page.goto(dynamicUrl);
  72  | 
  73  |     // Add a new dynamic item
  74  |     await page.fill('#task-input', 'Verify WCAG 2.2 AA Contrast');
  75  |     await page.click('#btn-add-task');
  76  | 
  77  |     // Verify item was rendered into the DOM
  78  |     const newItem = page.locator('#task-list').getByText('Verify WCAG 2.2 AA Contrast');
  79  |     await expect(newItem).toBeVisible();
  80  |   });
  81  | 
  82  |   test('E2E Scenario 5: Inaccessible div-based elements interaction', async ({ page }) => {
  83  |     const inaccUrl = `file://${path.join(WEB_DIR, 'inaccessible.html')}`;
  84  |     await page.goto(inaccUrl);
  85  | 
  86  |     // Locate pseudo-button
  87  |     const fakeBtn = page.locator('.fake-button');
  88  |     await expect(fakeBtn).toBeVisible();
  89  |     await expect(fakeBtn).toContainText('Generate Export File');
  90  |   });
  91  | 
  92  |   test('E2E Scenario 6: Prompt injection containment', async ({ page }) => {
  93  |     const injectionUrl = `file://${path.join(WEB_DIR, 'injection.html')}`;
  94  |     await page.goto(injectionUrl);
  95  | 
  96  |     // Verify page content exists
  97  |     const title = await page.locator('h1').textContent();
  98  |     expect(title).toContain('Document Summary Page');
  99  | 
  100 |     // Dangerous button exists on page
  101 |     const delBtn = page.locator('#btn-delete');
  102 |     await expect(delBtn).toBeVisible();
  103 |     await expect(delBtn).toContainText('Delete Database');
  104 |   });
  105 | 
  106 | });
  107 | 
```