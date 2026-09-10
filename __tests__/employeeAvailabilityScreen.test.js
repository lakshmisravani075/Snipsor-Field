import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import EmployeeAvailabilityScreen from '../src/screens/onboarding/screens/EmployeeAvailabilityScreen';
import {onboardingService} from '../src/services/apiService';

afterEach(() => jest.restoreAllMocks());
beforeEach(() => jest.spyOn(onboardingService, 'getMonthlyAvailability').mockResolvedValue([]));

test('loads employees and salon hours for a resumed step, then saves selected employee availability', async () => {
  jest.spyOn(onboardingService, 'getEmployees').mockResolvedValue({data: {employees: [{
    saloon_member_id: 'member-1', first_name: 'Ravi', last_name: 'Kumar', role: 'employee', gender: 'male',
  }]}});
  jest.spyOn(onboardingService, 'getAvailabilityState').mockResolvedValue({data: {availability: [{
    date: '2026-09-10', open_time: '09:00:00', close_time: '18:00:00', is_holiday: false,
  }]}});
  jest.spyOn(onboardingService, 'getEmployeeAvailabilityState').mockResolvedValue({data: {availability: []}});
  onboardingService.getMonthlyAvailability.mockResolvedValue({data: {availability: [{
    date: '2026-09-10', saloon_member_id: 'member-1', open_time: '10:00:00', close_time: '17:00:00', is_holiday: false,
  }]}});
  const save = jest.spyOn(onboardingService, 'saveEmployeeAvailability').mockResolvedValue({success: true});
  const onSave = jest.fn();
  let renderer;
  const press = async label => {
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.findAll(child => child.props.children === label).length);
    await act(async () => button.props.onPress());
  };
  try {
    await act(async () => { renderer = TestRenderer.create(<EmployeeAvailabilityScreen salonId="salon-1" onSave={onSave} />); });
    await act(async () => { await Promise.resolve(); });
    expect(onboardingService.getEmployees).toHaveBeenCalledWith('salon-1');
    expect(onboardingService.getAvailabilityState).toHaveBeenCalledWith('salon-1');
    expect(onboardingService.getEmployeeAvailabilityState).toHaveBeenCalledWith('salon-1');
    expect(onboardingService.getMonthlyAvailability).toHaveBeenCalledWith('2026-09', 'member-1');
    expect(renderer.root.findAll(node => Array.isArray(node.props.children) && node.props.children.includes('Ravi') && node.props.children.includes('Kumar')).length).toBeGreaterThan(0);
    await press('Save & Continue');
    expect(save).toHaveBeenCalledWith('salon-1', 'member-1', {availability: [{
      date: '2026-09-10', open_time: '10:00:00', close_time: '17:00:00', is_holiday: false,
    }]});
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({employeeId: 'member-1'}));
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
  }
});

test('keeps the editable day list and calls save when the salon availability response is empty', async () => {
  jest.spyOn(onboardingService, 'getEmployees').mockResolvedValue({data: {employees: [{saloon_member_id: 'member-2', first_name: 'Meena', last_name: 'Das'}]}});
  jest.spyOn(onboardingService, 'getAvailabilityState').mockResolvedValue([]);
  jest.spyOn(onboardingService, 'getAvailability').mockResolvedValue([]);
  jest.spyOn(onboardingService, 'getEmployeeAvailabilityState').mockResolvedValue([]);
  const save = jest.spyOn(onboardingService, 'saveEmployeeAvailability').mockResolvedValue({success: true});
  let renderer;
  const pressSave = async () => {
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.findAll(child => child.props.children === 'Save & Continue').length);
    await act(async () => button.props.onPress());
  };
  try {
    await act(async () => { renderer = TestRenderer.create(<EmployeeAvailabilityScreen salonId="salon-2" onSave={jest.fn()} />); });
    await act(async () => { await Promise.resolve(); });
    await pressSave();
    expect(save).toHaveBeenCalledWith('salon-2', 'member-2', expect.objectContaining({availability: expect.any(Array)}));
    expect(save.mock.calls[0][2].availability).toHaveLength(7);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
  }
});
