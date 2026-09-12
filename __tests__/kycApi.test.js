import {onboardingService, setAuthToken} from '../src/services/apiService';
import {bankPayload, beneficiaryAccountHolder, beneficiaryBankName, beneficiaryPayload, canFetchSavedKyc, errorCode, isExistingBeneficiaryError, isExistingKycError, isValidIfsc, kycAddressFromDetails, readKycDetails, verifyBankPayload} from '../src/screens/onboarding/screens/KycDetailsScreen';

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

test('treats the deployed beneficiary-not-found response as an empty result', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({success: false, message: 'Beneficiary not found', data: null}, 404));
  await expect(onboardingService.getBeneficiary('salon-1')).resolves.toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([
  [404, {message: 'Route not found'}],
  [401, {message: 'Unauthorized'}],
  [500, {success: false, message: 'Beneficiary not found', data: null}],
])('preserves other beneficiary request errors (%s)', async (status, body) => {
  global.fetch = jest.fn().mockResolvedValue(response(body, status));
  await expect(onboardingService.getBeneficiary('salon-1')).rejects.toMatchObject({status});
});

test('uses deployed KYC and beneficiary routes with the current session', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({success: true}));
  setAuthToken('test-token');
  const bank = bankPayload({bankName: 'Anita', account: '1234567890', ifsc: 'HDFC0001234', salonId: 'salon/1'});
  const verification = verifyBankPayload({bankName: 'Anita', account: '1234567890', ifsc: 'HDFC0001234', salonId: 'salon/1'});

  await onboardingService.getKycDetails('salon/1');
  await onboardingService.updateKycDetails('salon/1', bank);
  await onboardingService.verifyBankAccount(verification);
  await onboardingService.createBeneficiary({...bank, salon_details: {}, address: {}});
  await onboardingService.getBeneficiary('salon/1');
  await onboardingService.deleteBeneficiary('salon/1');

  const base = 'https://h6oc5ivg9a.execute-api.ap-south-1.amazonaws.com/dev/api/field/onboard';
  expect(global.fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
    [`${base}/bank-account-links/salon%2F1`, 'GET'],
    [`${base}/bank-account-links/salon%2F1`, 'PATCH'],
    [`${base}/bank-accounts/verify`, 'POST'],
    [`${base}/beneficiary`, 'POST'],
    [`${base}/beneficiaries/salon%2F1`, 'GET'],
    [`${base}/beneficiaries/salon%2F1`, 'DELETE'],
  ]);
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual(bank);
  expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual(verification);
  expect(verification).toEqual({account_holder_name: 'Anita', account_number: '1234567890', ifsc_code: 'HDFC0001234', saloon_id: 'salon/1'});
  for (const [, options] of global.fetch.mock.calls) {
    expect(options.headers.Authorization).toBe('Bearer test-token');
  }
});

test('normalizes saved KYC records and uses dynamic beneficiary details', () => {
  expect(canFetchSavedKyc({bank: {ifsc: 'HDFC0001234'}})).toBe(true);
  expect(canFetchSavedKyc({bank: {account: '123456'}})).toBe(true);
  expect(canFetchSavedKyc(null)).toBe(false);
  expect(isExistingKycError({message: 'KYC already exists'})).toBe(true);
  expect(errorCode({data: {error: {code: 'KYC_ALREADY_EXISTS'}}})).toBe('KYC_ALREADY_EXISTS');
  expect(isExistingKycError({data: {error: {code: 'KYC_ALREADY_EXISTS'}}})).toBe(true);
  expect(isExistingKycError({message: 'Unable to update KYC'})).toBe(false);
  expect(isExistingBeneficiaryError({status: 409, message: 'KYC already exists'})).toBe(true);
  expect(isExistingBeneficiaryError({status: 409, message: 'Beneficiary already exists'})).toBe(true);
  expect(isExistingBeneficiaryError({status: 400, message: 'KYC already exists'})).toBe(false);
  expect(isValidIfsc('SBIN0000562')).toBe(true);
  expect(isValidIfsc('SBIN0000562865')).toBe(false);
  expect(beneficiaryBankName('YES BANK')).toBe('Yes Bank');
  expect(beneficiaryAccountHolder({verifiedAccountHolder: 'Manish', enteredAccountHolder: 'kotha sravani'})).toBe('Manish');
  expect(kycAddressFromDetails({door: '12', building: 'Plaza', floor: '2', street: 'Road 1', landmark: 'Near park', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034'})).toEqual({
    line1: '12, Plaza', line2: '2, Near park', area: 'Road 1', landmark: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034',
  });
  expect(readKycDetails({data: {bank_account_link: {
    account_holder_name: 'Anita', account_number: '1234567890', ifsc_code: 'HDFC0001234', verification_status: 'VERIFIED',
  }}})).toMatchObject({bank: {bankName: 'Anita', account: '1234567890', ifsc: 'HDFC0001234'}, verified: true});
  expect(beneficiaryPayload({bankName: 'Anita', institutionName: 'HDFC Bank', account: '1234567890', ifsc: 'HDFC0001234', salonId: 'salon-1', salon: {name: 'Live Salon', owner: 'Anita', email: 'anita@example.com', phone: '9000000000'}, address: {line1: '1 Main Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001'}})).toEqual({
    account_holder_name: 'Anita', account_number: '1234567890', ifsc_code: 'HDFC0001234', saloon_id: 'salon-1', bank_name: 'HDFC Bank', business_type: 'SALON', legal_business_name: 'Live Salon', contact_name: 'Anita', contact_email: 'anita@example.com', contact_phone: '9000000000', address_line1: '1 Main Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001', use_existing_beneficiary: false,
  });
  expect(beneficiaryPayload({bankName: 'Anita', institutionName: 'HDFC Bank', account: '1234567890', ifsc: 'HDFC0001234', salonId: 'salon-1', salon: {name: 'Live salon'}, legalBusinessName: 'Live Salon'}).legal_business_name).toBe('Live Salon');
});
