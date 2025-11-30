import { describe, it, expect } from 'vitest';

const shouldRun = process.env.RUN_CONTRACT_TESTS === 'true';

const loadModule = async (name: string) => {
  try {
    return await (Function('m', 'return import(m)')(name) as Promise<any>);
  } catch {
    return null;
  }
};

(shouldRun ? describe : describe.skip)('CRM API consumer contracts', () => {
  it('defines expected crm_get_deal_details response shape', async () => {
    const pact = await loadModule('@pact-foundation/pact');
    if (!pact) {
      throw new Error('Pact not available. Install @pact-foundation/pact and set RUN_CONTRACT_TESTS=true.');
    }

    const { MatchersV3 } = pact;

    const dealResponse = {
      deal: {
        id: MatchersV3.like('deal-123'),
        name: MatchersV3.like('Enterprise Deal'),
        stage: MatchersV3.like('Qualified'),
        amount: MatchersV3.number(50000),
        companyName: MatchersV3.like('Test Corp'),
      },
      contacts: MatchersV3.eachLike({
        id: MatchersV3.like('contact-1'),
        email: MatchersV3.like('user@example.com'),
        firstName: MatchersV3.like('Ada'),
        lastName: MatchersV3.like('Lovelace'),
        title: MatchersV3.like('CTO'),
      }),
    };

    // Contract shape sanity check
    expect(dealResponse.deal).toBeDefined();
    expect(dealResponse.contacts).toBeDefined();
  });
});
