import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Alert, TextInput} from 'react-native';
import EmployeesScreen, {isAddressPrerequisiteError} from '../src/screens/onboarding/screens/EmployeesScreen';
import AddressScreen from '../src/screens/onboarding/screens/AddressScreen';
import {onboardingService} from '../src/services/apiService';

jest.mock('../src/screens/onboarding/screens/AddressScreen', () => jest.fn(() => null));

afterEach(() => jest.restoreAllMocks());

test('only handles the address prerequisite, leaving other API errors unchanged', () => {
  expect(isAddressPrerequisiteError({status: 400, message: 'Please complete Address added first'})).toBe(true);
  expect(isAddressPrerequisiteError({status: 400, message: 'Invalid phone'})).toBe(false);
  expect(isAddressPrerequisiteError({status: 403, message: 'Forbidden'})).toBe(false);
});

test('address recovery uses the same salon, retains employee input, and requires explicit retry', async () => {
  jest.spyOn(onboardingService, 'getEmployees').mockResolvedValue([]);
  const create = jest.spyOn(onboardingService, 'createEmployee')
    .mockRejectedValueOnce({status: 400, message: 'Please complete Address added first'})
    .mockResolvedValue({success: true});
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const onAddressSaved = jest.fn();
  let renderer;
  const press = async label => {
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node => node.findAll(child => child.props.children === label).length);
    await act(async () => button.props.onPress());
  };
  const input = async (placeholder, value) => {
    await act(async () => renderer.root.findAllByType(TextInput).find(node => node.props.placeholder === placeholder).props.onChangeText(value));
  };
  try {
    await act(async () => { renderer = TestRenderer.create(<EmployeesScreen salonId="selected-salon" onAddressSaved={onAddressSaved} />); });
    await press('Add employee');
    await input('Enter phone number', '9000000000');
    await press('Send OTP');
    await input('Enter OTP', '1234');
    await press('Verify');
    await input('Enter first name', 'Ravi');
    await input('Enter last name', 'Kumar');
    await press('Select role');
    await press('Employee');
    await press('Select gender');
    await press('Male');
    await input('Enter age', '25');
    await input('Enter years of experience', '2');
    await press('Save');
    const actions = alert.mock.calls[0][2];
    await act(async () => actions.find(action => action.text === 'Complete Address').onPress());
    expect(renderer.root.findByType(AddressScreen).props.salonId).toBe('selected-salon');
    const savedAddress = {coordinate: {latitude: 13, longitude: 79}, details: {city: 'City'}};
    await act(async () => renderer.root.findByType(AddressScreen).props.onSave(savedAddress));
    expect(onAddressSaved).toHaveBeenCalledWith(savedAddress);
    expect(create).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType(TextInput).find(node => node.props.placeholder === 'Enter first name').props.value).toBe('Ravi');
    await press('Save');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
  }
});
