import React, {useEffect, useRef, useState} from 'react';
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {authService} from '../../services/apiService';

// A versioned asset name prevents Android/Metro from reusing the stale
// fallback-only image entry after the artwork was updated.
const heroArtwork = require('../../assets/images/relative/login-hero-v2.png');

function LoginScreen({onSendOtp}) {
  const formScrollRef = useRef(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [isMobileTouched, setIsMobileTouched] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const {height} = useWindowDimensions();
  const heroHeight = Math.min(Math.max(height * 0.5, 355), 420);
  const isMobileValid = mobileNumber.length === 10;
  const showMobileError = isMobileTouched && !isMobileValid;

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      setTimeout(() => formScrollRef.current?.scrollToEnd({animated: true}), 80);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleSendOtp = async () => {
    setIsMobileTouched(true);
    setApiError('');

    if (!isMobileValid || isSendingOtp) {
      return;
    }

    try {
      setIsSendingOtp(true);
      await authService.sendOtp(mobileNumber);
      onSendOtp?.(mobileNumber);
    } catch (error) {
      setApiError(error.message || 'Unable to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleMobileChange = value => {
    setMobileNumber(value.replace(/\D/g, '').slice(0, 10));
    setApiError('');
    setTimeout(() => formScrollRef.current?.scrollToEnd({animated: false}), 40);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.screen}>
        <ImageBackground
          source={heroArtwork}
          resizeMode="cover"
          style={[styles.hero, {height: heroHeight}]}
          imageStyle={styles.heroImage}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>
              Snipsor <Text style={styles.brandAccent}>Field</Text>
            </Text>
            <Text style={styles.tagline}>Manage leads. Grow faster.</Text>
          </View>
        </ImageBackground>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.formSheet,
            isKeyboardVisible && styles.formSheetKeyboardVisible,
          ]}>
          <View style={styles.sheetSurface}>
            <View style={styles.dragHandle} />

            <ScrollView
              ref={formScrollRef}
              contentContainerStyle={[
                styles.formContent,
                isKeyboardVisible && styles.formContentKeyboardVisible,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Login with Mobile Number</Text>
            <Text style={styles.description}>
              We'll send you a 6-digit OTP to verify your number.
            </Text>

            <View
              style={[
                styles.phoneField,
                showMobileError && styles.phoneFieldError,
                isMobileValid && styles.phoneFieldValid,
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose country code"
                style={styles.countryCode}>
                <Text style={styles.countryText}>+91</Text>
                <View style={styles.chevron}>
                  <View style={styles.chevronLeft} />
                  <View style={styles.chevronRight} />
                </View>
              </Pressable>
              <View style={styles.divider} />
              <TextInput
                accessibilityLabel="Mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                onBlur={() => setIsMobileTouched(true)}
                onChangeText={handleMobileChange}
                placeholder="Enter mobile number"
                placeholderTextColor="#9499B1"
                style={styles.input}
                value={mobileNumber}
              />
              {isMobileValid && (
                <View style={styles.validIcon}>
                  <View style={styles.validCheck} />
                </View>
              )}
            </View>

            {(showMobileError || apiError) && (
              <View style={styles.errorMessage}>
                <View style={styles.errorIcon}>
                  <Text style={styles.errorIconText}>!</Text>
                </View>
                <Text style={styles.errorText}>
                  {showMobileError
                    ? 'Please enter a valid 10-digit mobile number.'
                    : apiError}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={isSendingOtp}
              onPress={handleSendOtp}
              style={({pressed}) => [
                styles.otpButton,
                showMobileError && styles.otpButtonWithError,
                pressed && styles.otpButtonPressed,
              ]}>
              <View style={styles.buttonSpacer} />
              <Text style={styles.buttonText}>Send OTP</Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  hero: {flexShrink: 0, justifyContent: 'flex-start'},
  heroImage: {backgroundColor: '#07143F'},
  brandBlock: {marginLeft: 24, marginTop: 103, alignSelf: 'flex-start'},
  brand: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '400',
    letterSpacing: -1,
  },
  brandAccent: {color: '#4D32FF'},
  tagline: {color: '#C6CAE0', fontSize: 12, marginTop: 5},
  formSheet: {
    flex: 1,
    marginTop: -22,
  },
  formSheetKeyboardVisible: {marginTop: -104},
  sheetSurface: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    overflow: 'hidden',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C9C5EC',
    marginTop: 11,
  },
  formContent: {paddingHorizontal: 39, paddingTop: 44, paddingBottom: 18},
  formContentKeyboardVisible: {paddingBottom: 70},
  title: {color: '#0A1237', fontSize: 20, fontWeight: '400'},
  description: {color: '#686E8F', fontSize: 13, marginTop: 10},
  phoneField: {
    height: 50,
    borderColor: '#E1E2E9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  phoneFieldError: {borderColor: '#FF6B76'},
  phoneFieldValid: {borderColor: '#D9DDE6'},
  countryCode: {
    height: '100%',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  countryText: {color: '#11183B', fontSize: 15, fontWeight: '400'},
  chevron: {width: 10, height: 7, position: 'relative'},
  chevronLeft: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#24305F',
    transform: [{rotate: '45deg'}],
  },
  chevronRight: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#24305F',
    transform: [{rotate: '-45deg'}],
  },
  divider: {width: 1, height: 24, backgroundColor: '#E5E6EC'},
  input: {flex: 1, color: '#11183B', fontSize: 14, paddingHorizontal: 14},
  validIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#16A33A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  validCheck: {
    width: 9,
    height: 5,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#16A33A',
    transform: [{rotate: '-45deg'}, {translateY: -1}],
  },
  errorMessage: {
    minHeight: 30,
    borderWidth: 1,
    borderColor: '#FFD0D4',
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    marginTop: 8,
  },
  errorIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F04452',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  errorIconText: {
    color: '#F04452',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 12,
  },
  errorText: {color: '#E33B49', fontSize: 11, flexShrink: 1},
  otpButton: {
    height: 50,
    borderRadius: 7,
    backgroundColor: '#050D35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 20,
  },
  otpButtonPressed: {opacity: 0.88},
  otpButtonWithError: {marginTop: 8},
  buttonSpacer: {width: 20},
  buttonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '400'},
  arrow: {color: '#FFFFFF', fontSize: 24, fontWeight: '400'},
});

export default LoginScreen;
