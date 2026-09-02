import React, {useEffect, useState} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import LoginScreen from './src/screens/login/LoginScreen.js';
import OtpScreen from './src/screens/login/OtpScreen.js';
import HomeScreen from './src/screens/home/HomeScreen.js';
import SplashScreen from './src/screens/login/SplashScreen.js';
import OnboardingTasksScreen from './src/screens/onboarding/screens/OnboardingTasksScreen.js';

const ONBOARDING_USER_MOBILE = '9000000002';

function App() {
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  const [isSplashVisible, setIsSplashVisible] = useState(!isTestEnvironment);
  const [mobileNumber, setMobileNumber] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      ) : showOnboarding ? (
        <OnboardingTasksScreen />
      ) : isAuthenticated ? (
        <HomeScreen />
      ) : mobileNumber ? (
        <OtpScreen
          mobileNumber={mobileNumber}
          onBack={() => setMobileNumber(null)}
          onVerified={() => {
            if (mobileNumber === ONBOARDING_USER_MOBILE) {
              setShowOnboarding(true);
              return;
            }
            setIsAuthenticated(true);
          }}
        />
      ) : (
        <LoginScreen onSendOtp={setMobileNumber} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
