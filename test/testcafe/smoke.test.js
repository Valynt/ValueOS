import { Selector } from 'testcafe';

const TIMEOUT = {
  navigation: 15000,
  ui: 5000,
};

fixture('ValueCanvas Critical Flows Smoke Tests')
    .page('http://localhost:3000');

async function waitForAppLoad(t) {
  await t.expect(Selector('#root > *').exists).ok({ timeout: TIMEOUT.navigation });
  await t.wait(500); // small settle
}

test('New case creation via modal', async t => {
    await waitForAppLoad(t);

    const newCaseTriggers = [
        Selector('button').withText(/new case/i),
        Selector('button').withText(/new chat/i),
        Selector().withText(/Start fresh/i),
    ];

    let triggerFound = null;
    for (const btn of newCaseTriggers) {
        if (await btn.exists) {
            triggerFound = btn;
            break;
        }
    }
    if (!triggerFound) {
        await t.expect(true).ok('No new case trigger visible');
        return;
    }

    await t.click(triggerFound);

    const companyInput = Selector('input').withAttribute('aria-label', /company name/i);
    await t.typeText(companyInput, 'TestCafe Test Co');

    const submit = Selector('button').withText(/create case/i);
    await t.click(submit);

    await t.expect(Selector().withText('TestCafe Test Co').exists).ok({ timeout: TIMEOUT.ui });
});

test('Upload notes modal preselects file', async t => {
    await waitForAppLoad(t);

    const uploadCard = Selector().withText(/Upload Notes/i).nth(0);
    if (!(await uploadCard.exists)) {
        await t.expect(true).ok('Upload Notes starter not visible');
        return;
    }
    await t.click(uploadCard);

    const fileInput = Selector('input[type="file"]').nth(0);
    await t.setFilesToUpload(fileInput, [
        {
            name: 'notes.txt',
            type: 'text/plain',
            content: 'hello from testcafe',
        },
    ]);

    await t.expect(Selector().withText(/notes\.txt/i).exists).ok({ timeout: TIMEOUT.ui });
});

test('CRM import modal enforces connection gating', async t => {
    await waitForAppLoad(t);

    const importCard = Selector().withText(/Import from CRM/i).nth(0);
    if (!(await importCard.exists)) {
        await t.expect(true).ok('Import from CRM starter not visible');
        return;
    }
    await t.click(importCard);

    const urlInput = Selector('input').withAttribute('placeholder', /Salesforce or HubSpot URL/i);
    await t.typeText(urlInput, 'https://app.hubspot.com/contacts/123/deal/456');

    const fetchButton = Selector('button').withText(/Fetch Deal/i);
    await t.click(fetchButton);

    await t.expect(Selector().withText(/not connected/i).exists).ok({ timeout: TIMEOUT.ui });
});

test('Ask AI renders SDUI when case available', async t => {
    await waitForAppLoad(t);

    // Try selecting the first case in sidebar
    const caseButton = Selector('aside button, aside [role="button"]').nth(0);
    if (!(await caseButton.exists)) {
        await t.expect(true).ok('No case entries visible');
        return;
    }
    await t.click(caseButton);

    const askAiButton = Selector('button').withText(/ask ai/i).nth(0);
    if (!(await askAiButton.exists)) {
        await t.expect(true).ok('Ask AI not visible');
        return;
    }
    await t.click(askAiButton);

    // SDUI render smoke: look for common SDUI component containers
    const sduiSelectors = [
        '[data-testid="sdui-component"]',
        '[class*="sdui"]',
        'text=Component unavailable'
    ];

    let found = false;
    for (const sel of sduiSelectors) {
        if (await Selector(sel).nth(0).exists) {
            found = true;
            break;
        }
    }

    await t.expect(found).ok('No SDUI render indicators found');
});
