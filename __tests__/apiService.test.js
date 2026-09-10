import {activationService, authService, clearAuthToken, leadService, onboardingService, setAuthToken} from '../src/services/apiService.js';
import {deleteSalonImage, getSalonImages, uploadSalonImage} from '../src/services/onboardingImages';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import FilesMediaScreen from '../src/screens/onboarding/screens/FilesMediaScreen';

jest.mock('react-native-image-picker', () => ({launchCamera: jest.fn(), launchImageLibrary: jest.fn()}));

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {get: () => 'application/json'},
  json: jest.fn(() => Promise.resolve(data)),
  text: jest.fn(() => Promise.resolve('')),
});

describe('authenticated API requests', () => {
  const originalFetch = global.fetch;

  test('address service uses deployed endpoints, dynamic salon IDs and existing auth', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({success: true}));
    setAuthToken('mock-access-token');
    const payload = {transportFixture: true};
    await onboardingService.getAddress('saved/salon');
    await onboardingService.saveAddress('saved/salon', payload);
    await onboardingService.deleteAddress('saved/salon');
    const url = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/saved%2Fsalon/address';
    expect(global.fetch.mock.calls.map(([endpoint, options]) => [endpoint, options.method])).toEqual([
      [url, 'GET'], [url, 'PUT'], [url, 'DELETE'],
    ]);
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({...payload, salon_id: 'saved/salon', saloon_id: 'saved/salon'});
    for (const [, options] of global.fetch.mock.calls) {
      expect(options.headers.Authorization).toBe('Bearer mock-access-token');
    }
  });

  test('address service rejects invalid inputs and propagates backend failures', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({message: 'Address lookup failed'}, 500));
    await expect(onboardingService.getAddress(undefined)).rejects.toMatchObject({status: 400});
    await expect(onboardingService.saveAddress('', {})).rejects.toMatchObject({status: 400});
    await expect(onboardingService.saveAddress('salon', null)).rejects.toMatchObject({status: 400});
    await expect(onboardingService.deleteAddress(' ')).rejects.toMatchObject({status: 400});
    expect(global.fetch).not.toHaveBeenCalled();
    await expect(onboardingService.getAddress('salon')).rejects.toMatchObject({status: 500, message: 'Address lookup failed'});
  });

  test('employee service uses the deployed onboarding endpoints and saved IDs', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({success: true}));
    const employee = {phone_number: '+919000000000', first_name: 'Ravi', last_name: 'Kumar', role: 'Employee', gender: 'Male'};
    await onboardingService.getEmployees('salon/1');
    await onboardingService.getEmployee('salon/1', 'member/1');
    await onboardingService.createEmployee('salon/1', employee);
    await onboardingService.updateEmployee('salon/1', 'member/1', employee);
    await onboardingService.updateEmployeeRole('salon/1', 'member/1', {role: 'Owner'});
    await onboardingService.deleteEmployee('salon/1', 'member/1');
    const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/employees';
    expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      [base, 'GET'], [base + '/member%2F1', 'GET'], [base, 'POST'], [base + '/member%2F1', 'PUT'], [base + '/member%2F1/role', 'PATCH'], [base + '/member%2F1', 'DELETE'],
    ]);
    expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual([employee]);
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toEqual(employee);
    expect(JSON.parse(global.fetch.mock.calls[4][1].body)).toEqual({role: 'Owner'});
  });

  test('service API uses the deployed onboarding endpoints and saved IDs', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({success: true}));
    const payload = {service_name: 'Haircut', price: 300, duration: 30, gender: 'MEN'};
    await onboardingService.getServices('salon/1');
    await onboardingService.getService('salon/1', 'service/1');
    await onboardingService.createService('salon/1', payload);
    await onboardingService.createServicesBulk('salon/1', {services: [payload]});
    await onboardingService.updateService('salon/1', 'service/1', payload);
    await onboardingService.patchService('salon/1', 'service/1', {price: 350});
    await onboardingService.deleteService('salon/1', 'service/1');
    const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/services';
    expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      [base, 'GET'], [base + '/service%2F1', 'GET'], [base + '/bulk', 'POST'], [base + '/bulk', 'POST'],
      [base + '/service%2F1', 'PUT'], [base + '/service%2F1', 'PATCH'], [base + '/service%2F1', 'DELETE'],
    ]);
    expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual({services: [payload]});
    expect(JSON.parse(global.fetch.mock.calls[3][1].body)).toEqual({services: [payload]});
    expect(JSON.parse(global.fetch.mock.calls[4][1].body)).toEqual(payload);
    expect(JSON.parse(global.fetch.mock.calls[5][1].body)).toEqual({price: 350});
  });

  test('Salon Images saves through presign, storage, confirm and GET before completing', async () => {
    const photo = {id: 'draft', uri: 'file:///salon.jpg', name: 'salon.jpg', type: 'image/jpeg'};
    const stored = {image_id: 'image-1', image_url: 'https://storage.example/salon.jpg'};
    const blob = {size: 100, type: 'image/jpeg'};
    let finishUpload;
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({data: []}))
      .mockResolvedValueOnce({blob: async () => blob})
      .mockResolvedValueOnce(jsonResponse({uploads: [{uploadUrl: 'https://storage.example/signed', fileUrl: stored.image_url, key: 'salon.jpg'}]}))
      .mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve; }))
      .mockResolvedValueOnce(jsonResponse({data: []}))
      .mockResolvedValueOnce(jsonResponse({success: true}))
      .mockResolvedValueOnce(jsonResponse({data: [stored]}))
      .mockResolvedValueOnce(jsonResponse({data: [stored]}));
    setAuthToken('mock-access-token');
    const onSave = jest.fn();
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<FilesMediaScreen salonId="saved/salon" initialPhotos={[photo]} onSave={onSave} />);
    });
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
      node.findAll(child => child.props.children === 'Save & Continue').length > 0);
    await act(async () => { button.props.onPress(); button.props.onPress(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual({file: {fileName: 'salon.jpg', contentType: 'image/jpeg'}});
    expect(global.fetch.mock.calls[2][0]).toContain('/saved%2Fsalon/images/presign');
    expect(global.fetch.mock.calls[3][1]).toMatchObject({method: 'PUT', body: blob});
    expect(global.fetch.mock.calls[3][1].headers).not.toHaveProperty('Authorization');
    await act(async () => { finishUpload({ok: true}); });
    expect(JSON.parse(global.fetch.mock.calls[5][1].body)).toEqual({image: {fileUrl: stored.image_url}});
    expect(onSave).toHaveBeenCalledWith([{id: 'image-1', uri: stored.image_url, uploaded: true}]);
    await act(async () => renderer.unmount());
  });

  test('failed storage upload never confirms or reports success', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({blob: async () => ({size: 100, type: 'image/jpeg'})})
      .mockResolvedValueOnce(jsonResponse({uploads: [{uploadUrl: 'https://storage.example/signed', fileUrl: 'https://storage.example/image'}]}))
      .mockResolvedValueOnce({ok: false, status: 403});
    const uploaded = jest.fn();
    await expect(uploadSalonImage('salon', {uri: 'file:///image.jpg', name: 'image.jpg'}, uploaded)).rejects.toThrow('Image upload failed');
    expect(uploaded).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('confirmation retry reuses a persisted image without uploading or confirming twice', async () => {
    const uri = 'https://storage.example/image.jpg';
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({data: [{image_id: 'saved-image', image_url: uri}]}));
    await expect(uploadSalonImage('salon', {uploadedUrl: uri}, jest.fn())).resolves.toEqual({id: 'saved-image', uri, uploaded: true});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].method).toBe('GET');
  });

  test('image loading rejects malformed records and deletion reloads the server list', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({data: [{image_url: 'https://storage.example/image'}]}))
      .mockResolvedValueOnce(jsonResponse({success: true}))
      .mockResolvedValueOnce(jsonResponse({data: []}));
    await expect(getSalonImages('salon')).rejects.toThrow('without its ID or URL');
    await expect(deleteSalonImage('salon', 'image/1')).resolves.toEqual([]);
    expect(global.fetch.mock.calls[1][0]).toContain('/images/image%2F1');
    expect(global.fetch.mock.calls[1][1].method).toBe('DELETE');
  });

  test('image endpoints preserve caller payloads and use saved IDs with authentication', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({success: true}));
    setAuthToken('mock-access-token');
    // Transport fixtures only: upload request fields require the backend contract.
    const payload = {transportFixture: true};
    await onboardingService.getImages('salon/1');
    await onboardingService.presignImage('salon/1', payload);
    await onboardingService.confirmImage('salon/1', payload);
    await onboardingService.deleteImage('salon/1', 'image/2');
    const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard/salon%2F1/images';
    expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      [base, 'GET'], [base + '/presign', 'POST'], [base + '/confirm', 'POST'], [base + '/image%2F2', 'DELETE'],
    ]);
    for (const [, options] of global.fetch.mock.calls) {
      expect(options.headers.Authorization).toBe('Bearer mock-access-token');
    }
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual(payload);
    expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual(payload);
  });

  test('image endpoints reject missing IDs and payloads without sending a request', async () => {
    global.fetch = jest.fn();
    await expect(onboardingService.getImages(undefined)).rejects.toMatchObject({status: 400});
    await expect(onboardingService.presignImage('salon', null)).rejects.toMatchObject({status: 400});
    await expect(onboardingService.confirmImage('salon', undefined)).rejects.toMatchObject({status: 400});
    await expect(onboardingService.deleteImage('salon', '')).rejects.toMatchObject({status: 400});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('posts QR completion to the live salon endpoint and rejects explicit API failure', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({accessToken: 'mock-access-token'}))
      .mockResolvedValueOnce(jsonResponse({success: true}))
      .mockResolvedValueOnce(jsonResponse({success: false, message: 'QR incomplete'}));
    await authService.login('9000000003', '123456');
    await expect(activationService.completeQr('salon/1')).resolves.toEqual({success: true});
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/salons/salon%2F1/activation/qr-complete');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer mock-access-token');
    expect(JSON.parse(options.body)).toEqual({});
    await expect(activationService.completeQr('salon/1')).rejects.toThrow('QR incomplete');
  });

  test('fetches the selected salon details using an encoded ID and auth token', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({accessToken: 'mock-access-token'}))
      .mockResolvedValueOnce(jsonResponse({data: {id: 'salon/1', salon_name: 'Live Salon'}}));
    await authService.login('9000000003', '123456');
    await activationService.getSalonDetails('salon/1');
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/salons/salon%2F1');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer mock-access-token');
  });

  test('gets activation salons from the deployed API with authentication', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({accessToken: 'mock-access-token'}))
      .mockResolvedValueOnce(jsonResponse({data: [{id: 'salon-1'}]}));
    await authService.login('9000000003', '123456');
    expect(await activationService.getSalons()).toEqual({data: [{id: 'salon-1'}]});
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe('https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/activation/salons');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer mock-access-token');
  });

  test('uses the access token for activation when login also returns an ID token', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse({id_token: 'id-token', access_token: 'access-token'}))
      .mockResolvedValueOnce(jsonResponse({data: []}));
    await authService.login('9000000003', '123456');
    await activationService.getSalons();
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer access-token');
  });

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
