import {onboardingService, setAuthToken, clearAuthToken} from '../src/services/apiService';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; clearAuthToken(); });

test('both endpoints reuse the deployed authenticated client and preserve responses', async () => {
  const response = {transportFixture: true};
  global.fetch = jest.fn().mockResolvedValue({ok: true, status: 200,
    headers: {get: () => 'application/json'}, json: async () => response});
  setAuthToken('test-token');
  await expect(onboardingService.getOnboardingStatus('salon/1')).resolves.toBe(response);
  await expect(onboardingService.getMonthlyAvailability('2026-12', 'member/2')).resolves.toBe(response);
  expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/onboarding-status',
    'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/availability/monthly?month=2026-12&saloon_member_id=member%2F2',
  ]);
  for (const [, options] of global.fetch.mock.calls) {
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer test-token');
  }
});

test('invalid parameters fail before sending requests', async () => {
  global.fetch = jest.fn();
  await expect(onboardingService.getOnboardingStatus('')).rejects.toMatchObject({status: 400});
  await expect(onboardingService.getMonthlyAvailability('2026-13', 'member')).rejects.toMatchObject({status: 400});
  await expect(onboardingService.getMonthlyAvailability('2026-09', null)).rejects.toMatchObject({status: 400});
  expect(global.fetch).not.toHaveBeenCalled();
});
