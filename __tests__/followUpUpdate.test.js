import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

import LeadDetailsScreen from '../src/screens/leads/LeadDetailsScreen';
import UpdateStatusScreen from '../src/screens/leads/UpdateStatusScreen';
import LeadHistoryScreen from '../src/screens/leads/LeadHistoryScreen';
import {leadService} from '../src/services/apiService';

jest.setTimeout(30000);

beforeEach(() => jest.clearAllMocks());

test('history shows the persisted nested follow-up when the live timeline still has the original schedule', async () => {
  leadService.getAcquisitionTimeline.mockResolvedValue({success: true, data: [
    {title: 'Lead Created', status: 'COMPLETED'},
    {title: 'Follow-up Scheduled for 2026-09-05 16:00:00', status: 'COMPLETED'},
  ]});
  leadService.getLeadDetails.mockResolvedValue({success: true, data: {
    status: 'FOLLOW_UP',
    follow_up: {follow_up_date: '2026-09-06T00:00:00.000Z', follow_up_time: '15:00:00'},
  }});
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<LeadHistoryScreen lead={{id: 'lead-1'}} status="Follow-up" />);
  });
  expect(renderer.root.findAll(node => node.props.children === 'Follow-up Scheduled for 2026-09-06 15:00:00').length).toBeGreaterThan(0);
  expect(renderer.root.findAll(node => node.props.children === 'Follow-up Scheduled for 2026-09-05 16:00:00')).toHaveLength(0);
  expect(renderer.root.findAll(node => node.props.children === 'Lead Created').length).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});

test('history uses each event schedule instead of stale title text and fetches again on reopening', async () => {
  leadService.getLeadDetails.mockResolvedValue({});
  const lead = {id: 'lead-1', name: 'Salon'};
  const original = {id: 'original', title: 'Follow-Up Scheduled for 2026-09-05 16:00:00'};
  leadService.getAcquisitionTimeline.mockResolvedValueOnce({timeline: [original]});
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<LeadHistoryScreen lead={lead} status="Follow-up" />);
  });
  await act(async () => renderer.unmount());
  leadService.getAcquisitionTimeline.mockResolvedValueOnce({timeline: [original, {
    id: 'updated',
    title: 'Follow-Up Scheduled for 2026-09-05 16:00:00',
    follow_up_date: '2026-09-12',
    follow_up_time: '18:00:00',
  }]});
  await act(async () => {
    renderer = TestRenderer.create(<LeadHistoryScreen lead={lead} status="Follow-up" />);
  });
  expect(renderer.root.findAll(node => node.props.children === 'Follow-Up Scheduled for 2026-09-12 18:00:00').length).toBeGreaterThan(0);
  expect(renderer.root.findAll(node => node.props.children === original.title).length).toBeGreaterThan(0);
  expect(leadService.getAcquisitionTimeline).toHaveBeenCalledTimes(2);
  await act(async () => renderer.unmount());
});

jest.mock('../src/services/apiService', () => ({
  leadService: {
    getLeadDetails: jest.fn(),
    getAcquisitionTimeline: jest.fn(),
    updateAcquisitionStatus: jest.fn(),
  },
}));

test('retains the saved schedule when the update response omits it and reopens with that time', async () => {
  const lead = {id: 'lead-1', name: 'Salon', status: 'Follow-up', followup: '2026-09-05'};
  leadService.getLeadDetails.mockResolvedValue({lead});
  leadService.getAcquisitionTimeline.mockResolvedValue([]);
  leadService.updateAcquisitionStatus.mockResolvedValue({status: 'FOLLOW_UP'});
  const onStatusUpdated = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<LeadDetailsScreen lead={lead} onStatusUpdated={onStatusUpdated} />);
  });
  const openUpdate = async () => {
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
      node.findAll(text => text.props.children === 'Update Status').length > 0);
    await act(async () => button.props.onPress());
  };
  await openUpdate();
  await act(async () => renderer.root.findByType(UpdateStatusScreen).props.onSave(
    'Follow-up', {status: 'FOLLOW_UP'},
    {status: 'FOLLOW_UP', follow_up_date: '2026-09-12', follow_up_time: '18:00', follow_up_note: null},
  ));
  expect(onStatusUpdated).toHaveBeenCalledWith('lead-1', 'Follow-up', expect.objectContaining({
    follow_up_date: '2026-09-12', follow_up_time: '18:00',
  }));
  await openUpdate();
  expect(renderer.root.findByType(UpdateStatusScreen).props.followup).toBe('2026-09-12');
  expect(renderer.root.findAll(node => node.props.children === '06:00 PM').length > 0).toBe(true);
  const save = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(text => text.props.children === 'Update Status').length > 0);
  await act(async () => save.props.onPress());
  expect(leadService.updateAcquisitionStatus).toHaveBeenCalledWith('lead-1', expect.objectContaining({
    follow_up_date: '2026-09-12', follow_up_time: '18:00',
  }));
  await act(async () => renderer.unmount());
});
