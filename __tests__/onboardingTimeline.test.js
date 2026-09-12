import {leadService, setAuthToken, clearAuthToken} from '../src/services/apiService';

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  headers: {get: () => 'application/json'}, json: async () => data,
});
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; clearAuthToken(); });

test('uses the supplied ID and existing authenticated deployed API client without interpreting the response', async () => {
  // Opaque transport fixture, not an assumed timeline schema.
  const response = {transportFixture: true};
  global.fetch = jest.fn().mockResolvedValue(jsonResponse(response));
  setAuthToken('test-token');
  await expect(leadService.getOnboardingTimeline('selected/lead')).resolves.toBe(response);
  expect(global.fetch).toHaveBeenCalledWith(
    'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/leads/selected%2Flead/onboarding/timeline',
    expect.objectContaining({method: 'GET', headers: expect.objectContaining({Authorization: 'Bearer test-token'})}),
  );
});

test.each([undefined, null, '', '  ', {}])('rejects invalid lead ID %p before making a request', async id => {
  global.fetch = jest.fn();
  await expect(leadService.getOnboardingTimeline(id)).rejects.toMatchObject({status: 400});
  expect(global.fetch).not.toHaveBeenCalled();
});

test('rejects null responses and propagates API errors', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(jsonResponse(null))
    .mockResolvedValueOnce(jsonResponse({message: 'Timeline unavailable'}, 500));
  await expect(leadService.getOnboardingTimeline('selected')).rejects.toMatchObject({status: 502});
  await expect(leadService.getOnboardingTimeline('selected')).rejects.toThrow('Timeline unavailable');
});
