import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import {authService, clearAuthToken, leadService} from '../src/services/apiService';

jest.mock('react-native-safe-area-context', () => ({SafeAreaProvider: ({children}) => children}));
jest.mock('../src/screens/login/LoginScreen', () => 'Login');
jest.mock('../src/screens/login/OtpScreen', () => 'Otp');
jest.mock('../src/screens/login/SplashScreen', () => 'Splash');
jest.mock('../src/screens/home/HomeScreen', () => 'Home');
jest.mock('../src/screens/onboarding/screens/OnboardingTasksScreen', () => 'Onboarding');
jest.mock('../src/screens/activation/ActivationScreen', () => 'Activation');

const originalFetch = global.fetch;
let credentials;
const response = (data, status = 200) => ({ok: status === 200, status, headers: {get: () => 'application/json'}, json: async () => data});

beforeEach(() => {
  jest.useFakeTimers();
  credentials = false;
  Keychain.getGenericPassword.mockImplementation(async () => credentials);
  Keychain.setGenericPassword.mockImplementation(async (username, password) => {
    credentials = {username, password};
    return {service: 'com.snipsor.field.session'};
  });
  Keychain.resetGenericPassword.mockImplementation(async () => { credentials = false; return true; });
  global.fetch = jest.fn().mockResolvedValue(response({access_token: 'saved-token'}));
});
afterEach(async () => {
  await clearAuthToken();
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test.each([['9000000001', 'Home'], ['9000000002', 'Onboarding'], ['9000000003', 'Activation']])(
  'restores %s to %s after a cold start and stays logged out after explicit logout', async (phone, screen) => {
    await authService.login(phone, '123456');
    // Simulate loss of all in-memory authentication on process termination.
    delete global.__SNIPSOR_FIELD_AUTH_TOKEN__;
    let restartedService;
    jest.isolateModules(() => { restartedService = require('../src/services/apiService'); });
    await expect(restartedService.authService.restoreSession()).resolves.toEqual({mobileNumber: phone});
    await restartedService.leadService.getLeads();
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer saved-token');
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    await act(async () => jest.advanceTimersByTime(2200));
    expect(renderer.root.findAllByType('Login')).toHaveLength(0);
    await act(async () => renderer.root.findByType(screen).props.onLogout());
    expect(renderer.root.findAllByType('Login')).toHaveLength(1);
    expect(credentials).toBe(false);
    await act(async () => renderer.unmount());
    await act(async () => { renderer = TestRenderer.create(<App />); });
    await act(async () => jest.advanceTimersByTime(2200));
    expect(renderer.root.findAllByType('Login')).toHaveLength(1);
    await act(async () => renderer.unmount());
  },
);

test('keeps the existing splash visible until session restoration finishes', async () => {
  let finish;
  Keychain.getGenericPassword.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<App />); });
  await act(async () => jest.advanceTimersByTime(2200));
  expect(renderer.root.findAllByType('Splash')).toHaveLength(1);
  await act(async () => finish({username: '9000000002', password: 'token'}));
  expect(renderer.root.findAllByType('Onboarding')).toHaveLength(1);
  await act(async () => renderer.unmount());
});

test('opens activation after a completed onboarding submission', async () => {
  await authService.login('9000000002', '123456');
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<App />); });
  await act(async () => jest.advanceTimersByTime(2200));
  await act(async () => renderer.root.findByType('Onboarding').props.onOnboardingComplete());
  expect(renderer.root.findAllByType('Onboarding')).toHaveLength(0);
  expect(renderer.root.findAllByType('Activation')).toHaveLength(1);
  await act(async () => renderer.unmount());
});

test('a server 401 removes the persisted session', async () => {
  await authService.login('9000000002', '123456');
  global.fetch.mockResolvedValue(response({message: 'Expired'}, 401));
  await expect(leadService.getLeads()).rejects.toMatchObject({status: 401});
  expect(credentials).toBe(false);
  await expect(authService.restoreSession()).resolves.toBeNull();
});

test('does not report login success if secure storage fails', async () => {
  Keychain.setGenericPassword.mockResolvedValueOnce(false);
  await expect(authService.login('9000000002', '123456')).rejects.toThrow('Unable to save');
  expect(credentials).toBe(false);
});

test('preserves session-expired handling if secure storage removal fails', async () => {
  await authService.login('9000000002', '123456');
  Keychain.resetGenericPassword.mockRejectedValueOnce(new Error('Storage unavailable'));
  global.fetch.mockResolvedValue(response({message: 'Expired'}, 401));
  await expect(leadService.getLeads()).rejects.toMatchObject({status: 401});
  await clearAuthToken();
  expect(credentials).toBe(false);
});
