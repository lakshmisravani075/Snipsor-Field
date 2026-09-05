import {authService, clearAuthToken, leadService} from '../src/services/apiService.js';

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {get: () => 'application/json'},
  json: jest.fn(() => Promise.resolve(data)),
  text: jest.fn(() => Promise.resolve('')),
});

describe('authenticated API requests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    clearAuthToken();
    global.fetch = originalFetch;
  });

  test('attaches the login access token to create-lead requests', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({data: {tokens: {accessToken: 'mock-access-token'}}}))
      .mockResolvedValueOnce(jsonResponse({data: {lead: {id: 'lead-1'}}}, 201));

    await authService.login('9000000001', '123456');
    await leadService.createLead({salon_name: 'Test Salon'});

    const leadRequestOptions = global.fetch.mock.calls[1][1];
    expect(leadRequestOptions.headers.Authorization).toBe('Bearer mock-access-token');
    expect(leadRequestOptions.headers['Content-Type']).toBe('application/json');
  });

  test('updates acquisition status using the selected lead ID', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({data: {accessToken: 'mock-access-token'}}))
      .mockResolvedValueOnce(jsonResponse({data: {lead: {id: 'lead-1', status: 'FOLLOW_UP'}}}));

    await authService.login('9000000001', '123456');
    await leadService.updateAcquisitionStatus('lead-1', {
      status: 'FOLLOW_UP',
      follow_up_date: '2026-09-04',
      follow_up_time: '16:00',
    });

    const [requestUrl, requestOptions] = global.fetch.mock.calls[1];
    expect(requestUrl).toContain('/field/leads/lead-1/acquisition/status');
    expect(requestOptions.method).toBe('PATCH');
    expect(requestOptions.headers.Authorization).toBe('Bearer mock-access-token');
    expect(JSON.parse(requestOptions.body)).toEqual({
      status: 'FOLLOW_UP',
      follow_up_date: '2026-09-04',
      follow_up_time: '16:00',
    });
  });

  test('gets acquisition timeline using the selected lead ID and auth token', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({data: {accessToken: 'mock-access-token'}}))
      .mockResolvedValueOnce(jsonResponse({data: {timeline: []}}));

    await authService.login('9000000001', '123456');
    await leadService.getAcquisitionTimeline('lead-1');

    const [requestUrl, requestOptions] = global.fetch.mock.calls[1];
    expect(requestUrl).toContain('/field/leads/lead-1/acquisition/timeline');
    expect(requestOptions.method).toBe('GET');
    expect(requestOptions.headers['Cache-Control']).toBe('no-cache');
    expect(requestOptions.headers.Authorization).toBe('Bearer mock-access-token');
  });
});
