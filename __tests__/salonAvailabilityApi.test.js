import {onboardingService, setAuthToken} from '../src/services/apiService';


import {availabilityPayload, readAvailability} from '../src/screens/onboarding/screens/SalonAvailabilityScreen';

const originalFetch = global.fetch;
const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {get: () => 'application/json'},
  json: async () => data,
});

afterEach(() => {
  global.fetch = originalFetch;
  setAuthToken(null);
});

test('maps API availability records to dynamic UI dates and serializes edits for saving', () => {
  const days = readAvailability({data: {availability: [{
    id: 'availability-1', date: '2026-09-09', open_time: '09:00:00', close_time: '21:00:00', is_holiday: false,
  }, {
    id: 'availability-2', date: '2026-09-10', open_time: '00:00:00', close_time: '00:00:00', is_holiday: true,
  }]}});
  expect(days).toEqual(expect.arrayContaining([
    expect.objectContaining({id: 'availability-1', date: '2026-09-09', day: 'Wednesday', dateLabel: 'Sep 09', open: true, from: '09:00 AM', to: '09:00 PM'}),
    expect.objectContaining({id: 'availability-2', date: '2026-09-10', day: 'Thursday', dateLabel: 'Sep 10', open: false}),
  ]));
  expect(availabilityPayload(days)).toEqual({availability: [
    {date: '2026-09-09', open_time: '09:00:00', close_time: '21:00:00', is_holiday: false},
    {date: '2026-09-10', open_time: '00:00:00', close_time: '00:00:00', is_holiday: true},
  ]});
});

test('reads nested backend availability records and string closed flags', () => {
  expect(readAvailability({data: {availability_state: {working_hours: [{
    availability_date: '2026-09-13', opening_time: '00:00:00', closing_time: '00:00:00', is_closed: 'true',
  }, {
    availability_date: '2026-09-14', opening_time: '10:00:00', closing_time: '18:00:00', is_open: 'true',
  }]}}})).toEqual(expect.arrayContaining([
    expect.objectContaining({date: '2026-09-13', open: false}),
    expect.objectContaining({date: '2026-09-14', open: true, from: '10:00 AM', to: '06:00 PM'}),
  ]));
});

test('availability uses deployed GET/PUT routes, the selected salon and session auth', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({success: true}));
  setAuthToken('test-token');
  // Opaque transport fixture; the endpoint schema is supplied by the backend.
  const payload = {transportFixture: true};
  await onboardingService.getAvailability('salon/1');
  await onboardingService.getAvailabilityState('salon/1');
  await onboardingService.saveAvailability('salon/1', payload);
  const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/availability';
  expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
    [base, 'GET'], [base + '/state', 'GET'], [base, 'PUT'],
  ]);
  expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual(payload);
  for (const [, options] of global.fetch.mock.calls) {
    expect(options.headers.Authorization).toBe('Bearer test-token');
  }
});

test('employee availability uses the selected salon, member, and session auth', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({success: true}));
  setAuthToken('test-token');
  const payload = {availability: [{date: '2026-09-09', open_time: '09:00:00', close_time: '21:00:00', is_holiday: false}]};
  await onboardingService.getEmployeeAvailabilityState('salon/1');
  await onboardingService.saveEmployeeAvailability('salon/1', 'member/1', payload);
  const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/employees';
  expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
    [base + '/availability/state', 'GET'], [base + '/member%2F1/availability', 'PUT'],
  ]);
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual(payload);
  for (const [, options] of global.fetch.mock.calls) {
    expect(options.headers.Authorization).toBe('Bearer test-token');
  }
});

test('availability rejects missing salon IDs and invalid payloads before sending', async () => {
  global.fetch = jest.fn();
  await expect(onboardingService.getAvailabilityState(undefined)).rejects.toMatchObject({status: 400});
  await expect(onboardingService.saveAvailability(' ', {})).rejects.toMatchObject({status: 400});
  await expect(onboardingService.saveAvailability('salon', null)).rejects.toMatchObject({status: 400});
  expect(global.fetch).not.toHaveBeenCalled();
});

test('availability propagates backend errors and unsuccessful saves', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({message: 'Unavailable'}, 500))
    .mockResolvedValueOnce(response({success: false, message: 'Invalid hours'}));
  await expect(onboardingService.getAvailabilityState('salon')).rejects.toMatchObject({status: 500, message: 'Unavailable'});
  await expect(onboardingService.saveAvailability('salon', {})).rejects.toThrow('Invalid hours');
});
