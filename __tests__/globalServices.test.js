import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import ServicesScreen, {readGlobalServices} from '../src/screens/onboarding/screens/ServicesScreen';
import {onboardingService, setAuthToken} from '../src/services/apiService';

afterEach(() => jest.restoreAllMocks());

test('global catalog uses the deployed services list route and existing authentication', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ok: true, headers: {get: () => 'application/json'}, json: async () => []});
  setAuthToken('test-token');
  try {
    await onboardingService.getGlobalServices();
    expect(global.fetch).toHaveBeenCalledWith('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/services/list', expect.objectContaining({method: 'GET', headers: expect.objectContaining({Authorization: 'Bearer test-token'})}));
  } finally {
    global.fetch = originalFetch;
    setAuthToken(null);
  }
});

test('normalizes catalog responses and rejects failures instead of treating them as empty lists', () => {
  for (const response of [[{service_id: 'cut', name: 'Haircut'}], {data: [{service_id: 'cut', name: 'Haircut'}]}, {data: {services: [{global_service_id: 'cut', service_name: 'Haircut'}]}}]) {
    expect(readGlobalServices(response)[0]).toMatchObject({id: 'cut', catalogId: 'cut', name: 'Haircut'});
  }
  expect(readGlobalServices([])).toEqual([]);
  expect(() => readGlobalServices({success: false, message: 'Unavailable'})).toThrow('Unavailable');
  expect(() => readGlobalServices({data: {}})).toThrow('invalid global service catalog');
});

test('catalog permission denial comes from the server and retries retain session authentication', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ok: false, status: 403, headers: {get: () => 'application/json'}, json: async () => ({message: 'Forbidden. You do not have permission to access this.'})});
  setAuthToken('test-field-token');
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(onboardingService.getGlobalServices()).rejects.toMatchObject({status: 403, message: 'Forbidden. You do not have permission to access this.'});
    }
    expect(global.fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of global.fetch.mock.calls) {
      expect(options.headers.Authorization).toBe('Bearer test-field-token');
    }
  } finally {
    global.fetch = originalFetch;
    setAuthToken(null);
  }
});

test('empty salons can select global services and saved-service refresh does not replace the catalog', async () => {
  jest.spyOn(onboardingService, 'getServices').mockResolvedValue([]);
  const catalog = jest.spyOn(onboardingService, 'getGlobalServices').mockResolvedValue({services: [{service_id: 'global-cut', name: 'Haircut'}]});
  const create = jest.spyOn(onboardingService, 'createService').mockResolvedValue({success: true});
  let renderer;
  const press = async label => {
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node => node.findAll(child => child.props.children === label).length);
    await act(async () => button.props.onPress());
  };
  try {
    await act(async () => { renderer = TestRenderer.create(<ServicesScreen salonId="salon-1" salonType="Men" />); });
    await press('Add services');
    expect(catalog).toHaveBeenCalledTimes(1);
    await press('Haircut');
    await press('Save');
    expect(create).toHaveBeenCalledWith('salon-1', {global_service_id: 'global-cut', service_name: 'Haircut', price: 300, duration_minutes: 30});
    await press('Add services');
    expect(catalog).toHaveBeenCalledTimes(2);
    await press('Haircut');
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
  }
});
