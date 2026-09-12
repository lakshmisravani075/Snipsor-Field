import React from 'react';
import {Alert} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import KycDetailsScreen from '../src/screens/onboarding/screens/KycDetailsScreen';
import {onboardingService} from '../src/services/apiService';

const bank = {account_holder_name: 'Anita', account_number: '1234567890', ifsc_code: 'HDFC0001234', verification_status: 'VERIFIED'};
const initialValues = {bank: {bankName: 'Anita', account: '1234567890', ifsc: 'HDFC0001234'}};
let renderer;
let onSave;
beforeEach(() => {
  onSave = jest.fn();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(onboardingService, 'getKycDetails').mockResolvedValue({data: {bank_account_link: bank}});
  jest.spyOn(onboardingService, 'getBeneficiary').mockResolvedValue(null);
  jest.spyOn(onboardingService, 'createBeneficiary').mockResolvedValue({success: true});
  jest.spyOn(onboardingService, 'updateKycDetails').mockResolvedValue({success: true});
});
afterEach(async () => {
  if (renderer) { await act(async () => renderer.unmount()); renderer = null; }
  jest.restoreAllMocks();
});
const mount = async () => {
  await act(async () => { renderer = TestRenderer.create(<KycDetailsScreen basicDetails={{salonId: 'salon-9'}} addressDetails={{details: {city: 'Hyderabad'}}} initialValues={initialValues} onSave={onSave} />); });
};
const noExistingKyc = () => onboardingService.getKycDetails.mockResolvedValue({data: {bank_account_link: {verification_status: 'VERIFIED'}}});
const save = async () => {
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function')
    .find(node => node.findAll(child => child.props.children === 'Save & Continue').length);
  await act(async () => button.props.onPress());
};

test('loads existing KYC by saved salon ID and creates its missing beneficiary', async () => {
  await mount();
  expect(onboardingService.getBeneficiary).toHaveBeenCalledWith('salon-9');
  await save();
  expect(onboardingService.getKycDetails).toHaveBeenCalledWith('salon-9');
  expect(onboardingService.updateKycDetails).not.toHaveBeenCalled();
  expect(onboardingService.createBeneficiary).toHaveBeenCalledWith(expect.objectContaining({
    saloon_id: 'salon-9', account_holder_name: 'Anita', account_number: '1234567890', ifsc_code: 'HDFC0001234',
  }));
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('does not complete KYC when beneficiary creation fails', async () => {
  noExistingKyc();
  onboardingService.createBeneficiary.mockResolvedValue({success: false, message: 'Creation failed'});
  await mount();
  await save();
  expect(onSave).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Unable to save KYC details', 'Creation failed');
});

test('preserves the full account for beneficiary creation when saved KYC returns only a masked number', async () => {
  noExistingKyc();
  await mount();
  await save();
  expect(onboardingService.createBeneficiary).toHaveBeenCalledWith(expect.objectContaining({
    saloon_id: 'salon-9', account_number: '1234567890',
  }));
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('accepts a duplicate only after confirming the same saved bank details', async () => {
  noExistingKyc();
  onboardingService.createBeneficiary.mockRejectedValue({status: 409, message: 'Beneficiary already exists'});
  onboardingService.getBeneficiary.mockResolvedValueOnce(null).mockResolvedValue({data: {beneficiary: bank}});
  await mount();
  await save();
  expect(onboardingService.getBeneficiary).toHaveBeenCalledTimes(2);
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('recognizes a directly returned saved beneficiary instead of submitting it again', async () => {
  onboardingService.getBeneficiary.mockResolvedValue({data: {beneficiary_id: 'beneficiary-1', saloon_id: 'salon-9', account_number: '1234567890', business_type: 'SALON'}});
  await mount();
  await save();
  expect(onboardingService.createBeneficiary).not.toHaveBeenCalled();
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('keeps the form open when duplicate beneficiary details differ', async () => {
  noExistingKyc();
  onboardingService.createBeneficiary.mockRejectedValue({status: 409, message: 'Beneficiary already exists'});
  onboardingService.getBeneficiary.mockResolvedValueOnce(null).mockResolvedValue({data: {beneficiary: {...bank, account_number: '9999999999'}}});
  await mount();
  await save();
  expect(onSave).not.toHaveBeenCalled();
});

test('does not submit a beneficiary when a verified KYC response has no account number', async () => {
  onboardingService.getKycDetails.mockResolvedValue({data: {bank_account_link: {verification_status: 'VERIFIED'}}});
  await act(async () => {
    renderer = TestRenderer.create(<KycDetailsScreen basicDetails={{salonId: 'salon-9'}} addressDetails={{details: {city: 'Hyderabad'}}} initialValues={{bank: {bankName: 'Anita', account: '', ifsc: 'HDFC0001234'}}} onSave={onSave} />);
  });
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function')
    .find(node => node.findAll(child => child.props.children === 'Save & Continue').length);
  expect(button.props.disabled).toBe(true);
  await act(async () => button.props.onPress());
  expect(onboardingService.createBeneficiary).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
});

test('submits KYC through the beneficiary endpoint without creating a bank-account link first', async () => {
  noExistingKyc();
  await mount();
  await save();
  expect(onboardingService.updateKycDetails).not.toHaveBeenCalled();
  expect(onboardingService.createBeneficiary).toHaveBeenCalledTimes(1);
});
