import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Linking} from 'react-native';
import TaskDetailsScreen from '../src/screens/onboarding/screens/TaskDetailsScreen';
import {leadService} from '../src/services/apiService';
import {mergeTaskDetails} from '../src/screens/onboarding/onboardingTasks';

jest.mock('@react-native-vector-icons/ionicons/static', () => ({Ionicons: 'Icon'}));
jest.mock('../src/services/apiService', () => ({leadService: {getLeadDetails: jest.fn()}}));
jest.setTimeout(30000);

test('loads selected lead details, uses the returned phone and address, and passes details to onboarding', async () => {
  leadService.getLeadDetails.mockResolvedValue({success: true, data: {
    id: 'lead-123', salon_name: 'Updated Salon', address: 'Actual API Address',
    contact_person: 'Owner', phone_number: '+919123456789', whatsapp_number: '+919876543210',
    business_type: 'Hair Salon', lead_source: 'Referral', assigned_on: '2026-09-06',
    assigned_to: {name: 'Assigned Agent'}, status: 'INTERESTED',
  }});
  const onContinue = jest.fn();
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<TaskDetailsScreen task={{id: 'lead-123', leadId: 'lead-123', name: 'Old Name', status: 'New'}} onContinue={onContinue} />);
  });
  expect(leadService.getLeadDetails).toHaveBeenCalledWith('lead-123');
  expect(renderer.root.findAll(node => node.props.children === 'Actual API Address').length).toBeGreaterThan(0);
  const call = renderer.root.findAll(node => node.props.accessibilityLabel === 'Call Updated Salon')[0];
  await act(async () => call.props.onPress());
  expect(openURL).toHaveBeenCalledWith('tel:+919123456789');
  const navigate = renderer.root.findAll(node => node.props.accessibilityLabel === 'Navigate to Updated Salon')[0];
  await act(async () => navigate.props.onPress());
  expect(openURL).toHaveBeenLastCalledWith(expect.stringContaining(encodeURIComponent('Updated Salon, Actual API Address')));
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(child => child.props.children === 'Start Onboarding').length > 0);
  act(() => button.props.onPress());
  expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({name: 'Updated Salon', whatsapp: '+919876543210', assignee: 'Assigned Agent', status: 'New'}));
  await act(async () => renderer.unmount());
  openURL.mockRestore();
});

test('rejects malformed details and preserves omitted summary fields', () => {
  expect(() => mergeTaskDetails({success: false}, {})).toThrow();
  expect(mergeTaskDetails({data: {lead: {id: '1', salon_name: 'Fresh'}}}, {phone: '9000000000', status: 'In Progress', onboardingStep: 4}))
    .toMatchObject({name: 'Fresh', phone: '9000000000', status: 'In Progress', onboardingStep: 4});
});
