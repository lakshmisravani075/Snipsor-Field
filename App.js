import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import LoginScreen from './src/screens/login/LoginScreen.js';
import OtpScreen from './src/screens/login/OtpScreen.js';
import HomeScreen from './src/screens/home/HomeScreen.js';
import SplashScreen from './src/screens/login/SplashScreen.js';
import OnboardingTasksScreen from './src/screens/onboarding/screens/OnboardingTasksScreen.js';
import ActivationScreen from './src/screens/activation/ActivationScreen.js';
import {authService, clearAuthToken} from './src/services/apiService.js';

const ONBOARDING_USER_MOBILE = '9000000002';
const ACTIVATION_USER_MOBILE = '9000000003';

function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [mobileNumber, setMobileNumber] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const openSession = phone => {
    setMobileNumber(phone);
    setShowActivation(phone === ACTIVATION_USER_MOBILE);
    setShowOnboarding(phone === ONBOARDING_USER_MOBILE);
    setIsAuthenticated(phone !== ACTIVATION_USER_MOBILE && phone !== ONBOARDING_USER_MOBILE);
  };

  const logout = async () => {
    try {
      await clearAuthToken();
      setShowActivation(false);
      setShowOnboarding(false);
      setIsAuthenticated(false);
      setMobileNumber(null);
    } catch {
      Alert.alert('Unable to log out', 'Please try again.', [{text: 'Retry', onPress: logout}]);
    }
  };

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const session = await authService.restoreSession();
        if (!active) { return; }
        if (session) { openSession(session.mobileNumber); }
        setSessionReady(true);
      } catch {
        if (active) {
          Alert.alert('Unable to restore login', 'Please try again.', [{text: 'Retry', onPress: restore}]);
        }
      }
    };
    restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const splashTimer = setTimeout(() => setIsSplashVisible(false), 2200);
    return () => clearTimeout(splashTimer);
  }, []);

  return (
    <SafeAreaProvider>
      {isSplashVisible || !sessionReady ? (
        <SplashScreen />
      ) : showActivation ? (
        <ActivationScreen onLogout={logout} />
      ) : showOnboarding ? (
        <OnboardingTasksScreen onLogout={logout} />
      ) : isAuthenticated ? (
        <HomeScreen onLogout={logout} />
      ) : mobileNumber ? (
        <OtpScreen
          mobileNumber={mobileNumber}
          onBack={() => setMobileNumber(null)}
          onVerified={() => openSession(mobileNumber)}
        />
      ) : (
        <LoginScreen onSendOtp={setMobileNumber} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
