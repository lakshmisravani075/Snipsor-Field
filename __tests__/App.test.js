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

test('renders correctly', async () => {
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  ReactTestRenderer.act(() => renderer.unmount());
});
