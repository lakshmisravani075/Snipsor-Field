/**
 * @format
 * JavaScript test for the starter app.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-vision-camera', () => {
  const ReactForMock = require('react');
  const {View} = require('react-native');
  return {
    Camera: props => ReactForMock.createElement(View, props),
    useCameraDevice: () => ({id: 'back-camera'}),
    useCameraPermission: () => ({
      hasPermission: false,
      requestPermission: jest.fn(() => Promise.resolve(false)),
    }),
    useCodeScanner: options => options,
  };
});

import App from '../App';
import {Alert, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AddressScreen, {getAddressLocation} from '../src/screens/onboarding/screens/AddressScreen';
import {onboardingService} from '../src/services/apiService';

test.each([true, false])('Address only completes after PUT and GET succeed: %p', async succeeds => {
  const values = {coordinate: {latitude: 13.6, longitude: 79.4}, details: {
    door: '11', building: '3', area: 'Locality', floor: '1', street: 'Road', landmark: 'Park', city: 'City', state: 'State', pincode: '500001', country: 'India', district: 'District',
  }};
  const record = {shop_number: '11', building_name: '3', area_locality: 'Locality', floor: '1', street: 'Road', landmark: 'Park', city: 'City', state: 'State', pincode: '500001', latitude: '13.6', longitude: '79.4'};
  const get = jest.spyOn(onboardingService, 'getAddress').mockRejectedValueOnce(new Error('Backend lookup failed')).mockResolvedValue({data: record});
  let finish;
  const put = jest.spyOn(onboardingService, 'saveAddress').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const onSave = jest.fn();
  let renderer;
  try {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AddressScreen salonId="actual-salon" initialValues={values} onSave={onSave} />);
    });
    expect(get).toHaveBeenCalledWith('actual-salon');
    const button = renderer.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
      node.findAll(child => child.props.children === 'Save & Continue').length > 0);
    await ReactTestRenderer.act(async () => { button.props.onPress(); button.props.onPress(); });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('actual-salon', {...record, latitude: 13.6, longitude: 79.4});
    expect(onSave).not.toHaveBeenCalled();
    await ReactTestRenderer.act(async () => { finish({success: succeeds, message: 'Save rejected'}); });
    if (succeeds) {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({coordinate: {latitude: 13.6, longitude: 79.4}}));
    } else {
      expect(onSave).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Unable to save address', 'Save rejected');
    }
  } finally {
    if (renderer) { await ReactTestRenderer.act(async () => renderer.unmount()); }
    get.mockRestore(); put.mockRestore(); alert.mockRestore();
  }
});

describe('Address current location', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'android';
    Geolocation.getCurrentPosition.mockReset();
  });
  afterEach(() => { Platform.OS = originalOS; Geolocation.getCurrentPosition.mockReset(); });

  test('falls back to network accuracy after a GPS timeout', async () => {
    Geolocation.getCurrentPosition
      .mockImplementationOnce((success, fail) => fail({code: 3}))
      .mockImplementationOnce(success => success({coords: {latitude: 13.6, longitude: 79.4}}));
    await expect(getAddressLocation()).resolves.toEqual({latitude: 13.6, longitude: 79.4});
    expect(Geolocation.getCurrentPosition.mock.calls[1][2]).toMatchObject({enableHighAccuracy: false, timeout: 15000});
  });

  test('does not retry a permission denial', async () => {
    Geolocation.getCurrentPosition.mockImplementationOnce((success, fail) => fail({code: 1}));
    await expect(getAddressLocation()).rejects.toMatchObject({code: 1});
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('uses the Android location manager when Google Play services are unavailable', async () => {
    Geolocation.getCurrentPosition
      .mockImplementationOnce((success, fail) => fail({code: 4}))
      .mockImplementationOnce(success => success({coords: {latitude: 13.6, longitude: 79.4}}));
    await getAddressLocation();
    expect(Geolocation.getCurrentPosition.mock.calls[1][2]).toMatchObject({forceLocationManager: true});
  });
});

test('renders correctly', async () => {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  ReactTestRenderer.act(() => renderer.unmount());
});
