import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import OnboardingTasksScreen from '../src/screens/onboarding/screens/OnboardingTasksScreen';
import {extractSavedSalonId, extractTaskLeads, formatAssignedOn, mergeTaskDetails, normalizeOnboardingTask, readSavedBeneficiary, resolveOnboardingResumeStep} from '../src/screens/onboarding/onboardingTasks';
import {leadService} from '../src/services/apiService';

jest.setTimeout(30000);
jest.mock('../src/services/apiService', () => ({leadService: {getLeads: jest.fn(), getLeadDetails: jest.fn(), getOnboardingTimeline: jest.fn()}}));
beforeEach(() => {
  jest.clearAllMocks();
  leadService.getLeadDetails.mockImplementation(async leadId => ({data: {lead: {id: leadId}}}));
});
jest.mock('@react-native-vector-icons/ionicons/static', () => ({Ionicons: 'Icon'}));
jest.mock('../src/screens/onboarding/screens/TaskDetailsScreen', () => 'TaskDetails');
jest.mock('../src/screens/onboarding/screens/SalonOnboardingScreen', () => 'SalonOnboarding');
jest.mock('../src/screens/onboarding/screens/OnboardingSalonsScreen', () => 'Salons');
jest.mock('../src/screens/profile/LogoutScreen', () => 'Logout');

test('maps real lead fields without treating acquisition status as onboarding progress', () => {
  const task = normalizeOnboardingTask({id: 'lead-1', salon_name: 'API Salon', status: 'FOLLOW_UP',
    address: {complete_address: 'Tirupati'}, contact_person: 'Owner', phone_number: '9000000000', assigned_to: {name: 'Agent'}});
  expect(task).toMatchObject({leadId: 'lead-1', name: 'API Salon', location: 'Tirupati', contact: 'Owner',
    phone: '9000000000', assignee: 'Agent', status: 'New', activity: '', onboardingStep: 1});
  expect(normalizeOnboardingTask({id: 'lead-2', onboarding: {status: 'IN_PROGRESS', current_step: 4}}))
    .toMatchObject({status: 'In Progress', onboardingStep: 4});
  expect(normalizeOnboardingTask({id: 'lead-3', onboarding_status: 'KYC_PENDING'}).status).toBe('KYC Pending');
  expect(normalizeOnboardingTask({id: 'lead-4', onboarding_status: 'PAYMENT_DETAILS_ADDED'}).onboardingComplete).toBe(true);
});

test('accepts wrapped and empty responses and rejects malformed responses', () => {
  expect(extractTaskLeads({data: {leads: [{id: '1'}]}})).toEqual([{id: '1'}]);
  expect(extractTaskLeads({data: []})).toEqual([]);
  expect(() => extractTaskLeads({message: 'Unexpected response'})).toThrow();
});

test('uses the assignee name relation rather than rendering the assigned user ID', () => {
  const assignedId = '02cc42eb-0de4-4b39-8998-9ac00b00a011';
  expect(normalizeOnboardingTask({id: '1', assigned_to: assignedId, assignee: {fullName: 'Maya Joshi'}}).assignee).toBe('Maya Joshi');
  expect(normalizeOnboardingTask({id: '1', assigned_to: assignedId, assigned_to_name: 'Agent Name'}).assignee).toBe('Agent Name');
  expect(normalizeOnboardingTask({id: '1', assigned_to: assignedId}).assignee).toBe('Name unavailable');
  expect(normalizeOnboardingTask({id: '1', assigned_agent: {first_name: 'Maya', last_name: 'Joshi'}}).assignee).toBe('Maya Joshi');
  expect(formatAssignedOn('2026-05-12T10:00:00.000Z')).toBe('12 May 2026');
});

test('uses the backend timeline to select the first incomplete onboarding step', () => {
  expect(resolveOnboardingResumeStep({data: {next_step: 4}}, 1)).toBe(4);
  expect(resolveOnboardingResumeStep({steps: [
    {step: 'BASIC_DETAILS', status: 'COMPLETED'}, {step: 'FILES_MEDIA', completed: true},
    {step: 'ADDRESS', status: 'PENDING'},
  ]}, 1)).toBe(3);
  expect(resolveOnboardingResumeStep({steps: [{step_number: 1, status: 'DONE'}, {step_number: 2, status: 'PENDING'}]}, 5)).toBe(2);
  expect(resolveOnboardingResumeStep({steps: [{key: 'PAYMENT_DETAILS_ADDED', completed: false}]}, 1)).toBe(8);
  expect(resolveOnboardingResumeStep({opaque: true}, 5)).toBe(5);
});

test('recognizes the saved beneficiary as durable KYC completion after restart', () => {
  expect(readSavedBeneficiary(null)).toBeNull();
  expect(readSavedBeneficiary({data: {beneficiary: {id: 'beneficiary-1'}}})).toEqual({id: 'beneficiary-1'});
  expect(readSavedBeneficiary({data: {beneficiaries: [{id: 'beneficiary-2'}]}})).toEqual({id: 'beneficiary-2'});
  expect(readSavedBeneficiary({data: {beneficiary_id: 'beneficiary-3', saloon_id: 'salon-1', account_number: '123456'}}))
    .toMatchObject({beneficiary_id: 'beneficiary-3'});
});

test('keeps the saved salon ID from lead details for resumed onboarding', () => {
  expect(mergeTaskDetails({data: {lead: {id: 'lead-1', onboarding: {salon: {saloon_id: 'saved-salon'}}}}}, {leadId: 'lead-1'}))
    .toMatchObject({salon_id: 'saved-salon'});
  expect(extractSavedSalonId({data: {salon: {salon_id: 'timeline-salon'}}})).toBe('timeline-salon');
  expect(extractSavedSalonId({data: {salon_details: {salon_id: 'saved-salon'}}})).toBe('saved-salon');
  expect(mergeTaskDetails({data: {lead: {id: 'lead-1'}, salon_details: {id: 'saved-salon'}}}, {leadId: 'lead-1'}))
    .toMatchObject({salon_id: 'saved-salon'});
  expect(extractSavedSalonId({id: 'lead-1'})).toBe('');
});

test('renders fetched tasks, searches API data and opens onboarding with the real lead', async () => {
  leadService.getLeads.mockResolvedValue({data: [
    {id: 'live-1', salon_name: 'API Salon', contact_person: 'Owner One'},
    {id: 'live-2', salon_name: 'Second Salon', contact_person: 'Owner Two'},
  ]});
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<OnboardingTasksScreen />); });
  expect(leadService.getLeads).toHaveBeenCalled();
  const hasText = value => renderer.root.findAll(node => node.props.children === value).length > 0;
  expect(hasText('API Salon')).toBe(true);
  expect(hasText('Hair & Beyond')).toBe(false);
  const search = renderer.root.findAll(node => node.props.placeholder === 'Search by salon or contact')[0];
  await act(async () => search.props.onChangeText('Owner Two'));
  expect(hasText('API Salon')).toBe(false);
  expect(hasText('Second Salon')).toBe(true);
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.props.onPress.length === 1 && node.findAll(child => child.props.children === 'Start Onboarding').length > 0);
  await act(async () => button.props.onPress({stopPropagation: jest.fn()}));
  expect(renderer.root.findByType('SalonOnboarding').props.salon.leadId).toBe('live-2');
  expect(leadService.getOnboardingTimeline).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
});

test('Continue fetches the selected timeline once, waits, and passes the untouched response into onboarding', async () => {
  leadService.getLeads.mockResolvedValue({data: [{id: 'selected-lead', salon_name: 'Live Salon', onboarding_status: 'IN_PROGRESS', onboarding_step: 4}]});
  let resolve;
  leadService.getOnboardingTimeline.mockReturnValue(new Promise(done => { resolve = done; }));
  leadService.getLeadDetails.mockResolvedValue({data: {lead: {id: 'selected-lead', salon_id: 'saved-salon', onboarding_step: 4}}});
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<OnboardingTasksScreen />); });
  const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.props.onPress.length === 1 && node.findAll(child => child.props.children === 'Continue Onboarding').length > 0);
  act(() => { button.props.onPress({stopPropagation: jest.fn()}); button.props.onPress({stopPropagation: jest.fn()}); });
  expect(leadService.getOnboardingTimeline).toHaveBeenCalledTimes(1);
  expect(leadService.getOnboardingTimeline).toHaveBeenCalledWith('selected-lead');
  expect(renderer.root.findAllByType('SalonOnboarding')).toHaveLength(0);
  expect(renderer.root.findAll(node => node.props.children === 'Loading...').length).toBeGreaterThan(0);
  const response = {opaqueTransportFixture: true};
  await act(async () => resolve(response));
  expect(renderer.root.findByType('SalonOnboarding').props.salon).toMatchObject({leadId: 'selected-lead', onboardingStep: 4, onboardingTimeline: response});
  expect(renderer.root.findByType('SalonOnboarding').props.salon.salon_id).toBe('saved-salon');
  await act(async () => renderer.unmount());
});

test('timeline failure keeps the user on the existing list and allows retry', async () => {
  leadService.getLeads.mockResolvedValue({data: [{id: 'selected-lead', onboarding_status: 'IN_PROGRESS'}]});
  leadService.getOnboardingTimeline.mockRejectedValue(new Error('Timeline unavailable'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<OnboardingTasksScreen />); });
  const press = () => renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.props.onPress.length === 1 && node.findAll(child => child.props.children === 'Continue Onboarding').length > 0).props.onPress({stopPropagation: jest.fn()});
  await act(async () => press());
  expect(alert).toHaveBeenCalledWith('Unable to continue onboarding', 'Timeline unavailable');
  expect(renderer.root.findAllByType('SalonOnboarding')).toHaveLength(0);
  await act(async () => press());
  expect(leadService.getOnboardingTimeline).toHaveBeenCalledTimes(2);
  await act(async () => renderer.unmount());
  alert.mockRestore();
});
