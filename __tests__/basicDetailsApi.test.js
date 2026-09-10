import {onboardingService, setAuthToken, clearAuthToken} from '../src/services/apiService';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import BasicDetailsScreen from '../src/screens/onboarding/screens/BasicDetailsScreen';

jest.setTimeout(30000);

test.each(['234012349865432', '2340123498654321', '36ABCDE1234F1Y5', '36ABCDE1234F1Z'])('blocks malformed GSTIN %s before sending a request', async gstNumber => {
  global.fetch = jest.fn();
  const onSave = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<BasicDetailsScreen salon={{leadId: 'selected-lead'}}
      initialValues={{salonName: 'Live Salon', mobileNumber: '9000000000', salonType: 'Unisex', gstRegistered: true, gstNumber}} onSave={onSave} />);
  });
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(child => child.props.children === 'Save & Continue').length > 0);
  expect(button.props.disabled).toBe(true);
  await act(async () => button.props.onPress());
  expect(global.fetch).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
});

test.each([[true, true], [true, false], [false, false]])('Save sends backend fields with GST %p and exclusive tax %p and waits for POST', async (gstRegistered, priceExclusive) => {
  let finish;
  global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const onSave = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<BasicDetailsScreen salon={{leadId: 'selected-lead'}}
      initialValues={{salonName: 'Live Salon', mobileNumber: '9000000000', salonType: 'Unisex', gstRegistered, priceExclusive, gstNumber: '36ABCDE1234F1Z5'}} onSave={onSave} />);
  });
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(child => child.props.children === 'Save & Continue').length > 0);
  act(() => { button.props.onPress(); button.props.onPress(); });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][1].method).toBe('POST');
  const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(payload).toMatchObject({lead_id: 'selected-lead', name: 'Live Salon', phone_number: '9000000000', mobile_number: '9000000000', phone: '9000000000', mobile: '9000000000', is_gst_registered: gstRegistered, gst_registered: gstRegistered, is_gst_number_registered: gstRegistered, gst_info: gstRegistered ? '36ABCDE1234F1Z5' : null, gst_number: gstRegistered ? '36ABCDE1234F1Z5' : null, gstin: gstRegistered ? '36ABCDE1234F1Z5' : null, gstin_number: gstRegistered ? '36ABCDE1234F1Z5' : null, price_includes_tax: !(gstRegistered && priceExclusive)});
  expect(payload).not.toHaveProperty('price_exclusive');
  expect(payload).not.toHaveProperty('salon_name');
  expect(onSave).not.toHaveBeenCalled();
  await act(async () => {
    // Subsequent GET models reopening/loading by the saved salon ID.
    global.fetch.mockResolvedValue(response({data: {salon_id: 'saved-salon', name: 'Live Salon', is_gst_registered: gstRegistered}}));
    finish(response({success: true, data: {salon_id: 'saved-salon'}}));
  });
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({salonId: 'saved-salon'}));
  await act(async () => renderer.unmount());
});

test('loads saved basic details from the backend salon_details response', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({data: {salon_details: {
    name: 'Urban', phone_number: '+919632580741', salon_type: 'Unisex', is_gst_registered: false,
  }}}));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<BasicDetailsScreen salon={{salon_id: 'saved-salon'}} />);
  });
  const inputs = renderer.root.findAll(node => node.props.placeholder);
  expect(inputs.find(node => node.props.placeholder === 'Enter salon name').props.value).toBe('Urban');
  expect(inputs.find(node => node.props.placeholder === 'Enter mobile number').props.value).toBe('9632580741');
  expect(renderer.root.findAll(node => node.props.children === 'Unisex').length).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

test('loads mobile and GST values from alternate nested salon response fields', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({data: {
    saloon_details: {name: 'Urban', salon_type: 'Men'},
    salon_contact: {mobile: '+919632580741'},
    gst_details: {is_registered: 'true', gstin: '36ABCDE1234F1Z5'},
  }}));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<BasicDetailsScreen salon={{salon_id: 'saved-salon'}} />);
  });
  const inputs = renderer.root.findAll(node => node.props.placeholder);
  expect(inputs.find(node => node.props.placeholder === 'Enter mobile number').props.value).toBe('9632580741');
  expect(inputs.find(node => node.props.placeholder === 'GSTIN').props.value).toBe('36ABCDE1234F1Z5');
  expect(renderer.root.findAllByProps({accessibilityRole: 'switch'}).some(node => node.props.accessibilityState.checked)).toBe(true);
  await act(async () => renderer.unmount());
});

test('retains saved mobile and GST after relaunch when the backend omits them', async () => {
  Keychain.getGenericPassword.mockResolvedValueOnce({username: 'basic-details', password: JSON.stringify({
    mobileNumber: '9632580741', gstRegistered: true, gstNumber: '36ABCDE1234F1Z5',
  })});
  global.fetch = jest.fn().mockResolvedValue(response({data: {salon_details: {name: 'Urban', salon_type: 'Men'}}}));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<BasicDetailsScreen salon={{salon_id: 'saved-salon'}} />);
  });
  const inputs = renderer.root.findAll(node => node.props.placeholder);
  expect(inputs.find(node => node.props.placeholder === 'Enter mobile number').props.value).toBe('9632580741');
  expect(inputs.find(node => node.props.placeholder === 'GSTIN').props.value).toBe('36ABCDE1234F1Z5');
  expect(renderer.root.findAllByProps({accessibilityRole: 'switch'}).some(node => node.props.accessibilityState.checked)).toBe(true);
  await act(async () => renderer.unmount());
});

const originalFetch = global.fetch;
test('loads details when the saved salon ID arrives after the form mounts and updates that salon', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({data: {salon_details: {
    salon_id: 'resumed-salon', name: 'Urban', phone_number: '+919632580741', salon_type: 'Unisex',
    is_gst_registered: true, price_includes_tax: false, gst_info: '36ABCDE1234F1Z5',
  }}}));
  const onSave = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<BasicDetailsScreen salon={{leadId: 'lead-1'}} onSave={onSave} />);
  });
  expect(global.fetch).not.toHaveBeenCalled();
  await act(async () => {
    renderer.update(<BasicDetailsScreen salon={{leadId: 'lead-1'}} initialValues={{salonId: 'resumed-salon'}} onSave={onSave} />);
  });
  const inputs = renderer.root.findAll(node => node.props.placeholder);
  expect(inputs.find(node => node.props.placeholder === 'Enter salon name').props.value).toBe('Urban');
  expect(inputs.find(node => node.props.placeholder === 'Enter mobile number').props.value).toBe('9632580741');
  expect(inputs.find(node => node.props.placeholder === 'GSTIN').props.value).toBe('36ABCDE1234F1Z5');
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(child => child.props.children === 'Save & Continue').length > 0);
  await act(async () => button.props.onPress());
  expect(global.fetch.mock.calls[1][0]).toContain('/field/onboard/resumed-salon');
  expect(global.fetch.mock.calls[1][1].method).toBe('PATCH');
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({salonId: 'resumed-salon', salonName: 'Urban', priceExclusive: true}));
  await act(async () => renderer.unmount());
});

const response = data => ({ok: true, status: 200, headers: {get: () => 'application/json'}, json: async () => data});
afterEach(() => { global.fetch = originalFetch; clearAuthToken(); });

test('uses the deployed onboarding endpoints, auth and correct HTTP methods', async () => {
  // Transport-only fixture; form field names must come from the backend contract.
  const payload = {transportFixture: true};
  const data = {opaqueResponseFixture: true};
  global.fetch = jest.fn().mockResolvedValue(response(data));
  setAuthToken('test-token');
  await expect(onboardingService.createBasicDetails(payload)).resolves.toBe(data);
  await expect(onboardingService.getBasicDetails('saved/salon')).resolves.toBe(data);
  await expect(onboardingService.updateBasicDetails('saved/salon', payload)).resolves.toBe(data);
  await expect(onboardingService.deleteBasicDetails('saved/salon')).resolves.toBe(data);
  const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/';
  expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
    [base, 'POST'], [base + 'saved%2Fsalon', 'GET'], [base + 'saved%2Fsalon', 'PATCH'], [base + 'saved%2Fsalon', 'DELETE'],
  ]);
  for (const [, options] of global.fetch.mock.calls) expect(options.headers.Authorization).toBe('Bearer test-token');
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual(payload);
  expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual(payload);
  expect(global.fetch.mock.calls[3][1].body).toBeUndefined();
});

test.each([null, undefined, '', '   ', {}])('rejects missing or invalid salon ID %p without a request', async id => {
  global.fetch = jest.fn();
  await expect(onboardingService.getBasicDetails(id)).rejects.toMatchObject({status: 400});
  await expect(onboardingService.updateBasicDetails(id, {})).rejects.toMatchObject({status: 400});
  await expect(onboardingService.deleteBasicDetails(id)).rejects.toMatchObject({status: 400});
  expect(global.fetch).not.toHaveBeenCalled();
});

test('propagates server errors and rejects missing save payloads', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: false, status: 422, headers: {get: () => 'application/json'}, json: async () => ({message: 'Invalid basic details'})});
  await expect(onboardingService.createBasicDetails(null)).rejects.toMatchObject({status: 400});
  expect(global.fetch).not.toHaveBeenCalled();
  await expect(onboardingService.createBasicDetails({})).rejects.toThrow('Invalid basic details');
});
