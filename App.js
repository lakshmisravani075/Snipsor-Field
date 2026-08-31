import React, {useEffect, useState} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import LoginScreen from './src/screens/login/LoginScreen.js';
import OtpScreen from './src/screens/login/OtpScreen.js';
import HomeScreen from './src/screens/home/HomeScreen.js';
import SplashScreen from './src/screens/login/SplashScreen.js';

function App() {
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  const [isSplashVisible, setIsSplashVisible] = useState(!isTestEnvironment);
  const [mobileNumber, setMobileNumber] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (isTestEnvironment) {
      return undefined;
    }
    const splashTimer = setTimeout(() => setIsSplashVisible(false), 2200);
    return () => clearTimeout(splashTimer);
  }, [isTestEnvironment]);

  return (
    <SafeAreaProvider>
      {isSplashVisible ? (
        <SplashScreen />
      ) : isAuthenticated ? (
        <HomeScreen />
      ) : mobileNumber ? (
        <OtpScreen
          mobileNumber={mobileNumber}
          onBack={() => setMobileNumber(null)}
          onVerified={() => setIsAuthenticated(true)}
        />
      ) : (
        <LoginScreen onSendOtp={setMobileNumber} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
