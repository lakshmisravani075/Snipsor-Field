import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Alert, AppState, Animated} from 'react-native';
import {activationService} from '../src/services/apiService';
import {QrVerificationScreen} from '../src/screens/activation/ActivationScreen';

jest.mock('@react-native-vector-icons/ionicons/static', () => ({Ionicons: 'Icon'}));
jest.mock('../src/services/apiService', () => ({activationService: {completeQr: jest.fn()}}));
jest.mock('react-native-image-picker', () => ({launchImageLibrary: jest.fn()}));
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => ({id: 'back', hasTorch: true}),
  useCameraPermission: () => ({hasPermission: true, requestPermission: jest.fn()}),
  useCodeScanner: options => options,
}));
jest.setTimeout(30000);

test('saves a scanned QR once and permits training only after the API succeeds', async () => {
  AppState.currentState = 'active';
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let resolveRequest;
  activationService.completeQr.mockReturnValue(new Promise(resolve => { resolveRequest = resolve; }));
  const onVerified = jest.fn();
  const onContinue = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<QrVerificationScreen salon={{id: 'live-1', displayId: 'SAL-9012', qrId: 'QR-9012'}} onVerified={onVerified} onContinue={onContinue} />);
  });
  act(() => renderer.root.findByType('Camera').props.onPreviewStarted());
  const scan = renderer.root.findByType('Camera').props.codeScanner.onCodeScanned;
  // The live API determines whether the poster belongs to this selected salon;
  // the client must not require a hard-coded QR payload format before posting.
  const codes = [{type: 'qr', value: 'https://qr.snipsor.example/poster/live-1'}];
  act(() => { scan(codes); scan(codes); });
  expect(activationService.completeQr).toHaveBeenCalledTimes(1);
  expect(activationService.completeQr).toHaveBeenCalledWith('live-1');
  expect(onVerified).not.toHaveBeenCalled();
  const continueButton = () => renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(child => child.props.children === 'Continue to Training').length > 0);
  act(() => continueButton().props.onPress());
  expect(onContinue).not.toHaveBeenCalled();
  await act(async () => resolveRequest({success: true}));
  expect(onVerified).toHaveBeenCalledWith({success: true});
  act(() => continueButton().props.onPress());
  expect(onContinue).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
  alert.mockRestore();
});

test('posts the first native scan even if the preview-ready render has not completed', async () => {
  AppState.currentState = 'active';
  activationService.completeQr.mockResolvedValue({success: true});
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<QrVerificationScreen salon={{id: 'live-2'}} />);
  });
  const scan = renderer.root.findByType('Camera').props.codeScanner.onCodeScanned;
  await act(async () => scan([{type: 'qr', value: 'dynamic-qr-value'}]));
  expect(activationService.completeQr).toHaveBeenCalledWith('live-2');
  await act(async () => renderer.unmount());
});

test('waits for preview before timing out, permits flash after timeout and restarts failed camera', async () => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  const animation = jest.spyOn(Animated, 'loop').mockReturnValue({start: jest.fn(), stop: jest.fn()});
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<QrVerificationScreen salon={{id: '1', displayId: 'SAL-0001', qrId: 'QR-0001'}} />);
  });
  const camera = () => renderer.root.findByType('Camera');
  const button = label => renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
    node.findAll(child => child.props.children === label).length > 0);
  act(() => jest.advanceTimersByTime(13000));
  expect(button('Scan Again')).toBeUndefined();
  act(() => camera().props.onPreviewStarted());
  act(() => button('Turn on Flash').props.onPress());
  expect(camera().props.torch).toBe('on');
  act(() => jest.advanceTimersByTime(13000));
  expect(button('Scan Again')).toBeDefined();
  expect(button('Turn on Flash').props.disabled).toBe(false);
  act(() => button('Turn on Flash').props.onPress());
  expect(camera().props.torch).toBe('on');
  act(() => camera().props.onError({code: 'session/camera-not-ready'}));
  expect(camera().props.torch).toBe('off');
  act(() => button('Scan Again').props.onPress());
  act(() => camera().props.onPreviewStarted());
  expect(button('Turn on Flash').props.disabled).toBe(false);
  await act(async () => renderer.unmount());
  animation.mockRestore();
  jest.useRealTimers();
});
