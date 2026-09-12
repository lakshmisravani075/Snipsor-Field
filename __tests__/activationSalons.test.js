import {extractActivationSalons, mergeActivationDetails, normalizeActivationSalon} from '../src/screens/activation/activationSalons';

test('uses fresh salon details while preserving activation state and omitted fields', () => {
  const summary = {id: 'uuid-1', displayId: 'SAL-9012', name: 'Old Name', phone: 'old-phone',
    status: 'Training Pending', qrId: 'qr-1'};
  const result = mergeActivationDetails({data: {salon: {id: 'uuid-1', salon_name: 'Updated Salon',
    phone_number: '9000000000', status: 'ACTIVE'}}}, summary);
  expect(result).toMatchObject({id: 'uuid-1', displayId: 'SAL-9012', name: 'Updated Salon',
    phone: '9000000000', status: 'Training Pending', qrId: 'qr-1'});
  expect(mergeActivationDetails({data: {id: 'uuid-1', activation_status: 'READY_ACTIVATION'}}, summary).status).toBe('Ready Activation');
  expect(mergeActivationDetails({data: {id: 'uuid-1', activation_status: 'TRAINING_COMPLETED'}}, summary).status).toBe('Ready Activation');
  expect(mergeActivationDetails({data: {id: 'uuid-1', activation_status: 'ACTIVATED'}}, summary).activationStatus).toBe('ACTIVATED');
  expect(() => mergeActivationDetails({success: true, data: {}}, summary)).toThrow();
});

test('maps live salon fields and activation states without sample data', () => {
  expect(normalizeActivationSalon({salon_id: 'uuid-1', salon_code: 'SAL-9012', salon_name: 'API Salon',
    address: {complete_address: 'Tirupati'}, owner: {name: 'Owner', phone_number: '9000000000'},
    activation_status: 'TRAINING_PENDING', qr_id: 'live-qr'})).toMatchObject({
    id: 'uuid-1', displayId: 'SAL-9012', name: 'API Salon', address: 'Tirupati', owner: 'Owner',
    phone: '9000000000', status: 'Training Pending', qrId: 'live-qr', date: '',
  });
  expect(normalizeActivationSalon({id: 'uuid-2', status: 'READY_FOR_ACTIVATION'}).status).toBe('Ready Activation');
  expect(normalizeActivationSalon({id: 'uuid-ready', activation_status: 'READY_TO_ACTIVATE'}).status).toBe('Ready Activation');
  expect(normalizeActivationSalon({id: 'uuid-training', activation_status: 'TRAINING_COMPLETED'}).status).toBe('Ready Activation');
  expect(normalizeActivationSalon({id: 'uuid-active', activation_status: 'ACTIVATED'}).status).toBe('Active');
  expect(normalizeActivationSalon({id: 'uuid-3', status: 'QR_PENDING'})).toMatchObject({displayId: 'uuid-3', status: 'QR Pending', qrId: '', owner: ''});
  expect(normalizeActivationSalon({saloon_id: 'uuid-4', salon_name: 'Deployed API Salon'}))
    .toMatchObject({id: 'uuid-4', displayId: 'uuid-4', name: 'Deployed API Salon'});
  expect(normalizeActivationSalon({saloon_id: 'uuid-5', saloon_address: {address_line1: 'Road 1', city: 'Hyderabad'},
    contact_details: {full_name: 'Royal Owner', mobile_number: '9000000000'}}))
    .toMatchObject({address: 'Road 1', owner: 'Royal Owner', phone: '9000000000'});
});

test('accepts list and wrapped responses and preserves empty lists', () => {
  expect(extractActivationSalons({data: {salons: [{id: '1'}]}})).toEqual([{id: '1'}]);
  expect(extractActivationSalons({data: []})).toEqual([]);
  expect(() => extractActivationSalons({success: false})).toThrow();
});
