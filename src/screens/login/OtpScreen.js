// @refresh reset
import React, {useEffect, useRef, useState} from 'react';
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

const heroArtwork = require('../../assets/images/relative/login-hero.png');
const OTP_LENGTH = 6;
const RESEND_SECONDS = 28;
const DEMO_OTP = '123456';

function OtpScreen({mobileNumber, onBack, onVerified}) {
  const [otpDigits, setOtpDigits] = useState(() =>
    Array(OTP_LENGTH).fill(''),
  );
  const [otpStatus, setOtpStatus] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef(null);
  const {height} = useWindowDimensions();
  const heroHeight = Math.min(Math.max(height * 0.43, 300), 365);
  const otp = otpDigits.join('');

  useEffect(() => {
    if (secondsLeft === 0) {
      return undefined;
    }

    const timer = setTimeout(() => setSecondsLeft(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleOtpChange = value => {
    const digit = value.replace(/\D/g, '').slice(-1);

    if (!digit || activeIndex === null) {
      return;
    }

    setOtpDigits(currentDigits => {
      const nextDigits = [...currentDigits];
      nextDigits[activeIndex] = digit;
      return nextDigits;
    });
    setOtpStatus(null);
    setActiveIndex(index => Math.min(index + 1, OTP_LENGTH - 1));
  };

  const handleOtpBoxPress = index => {
    setActiveIndex(index);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleOtpKeyPress = ({nativeEvent}) => {
    if (nativeEvent.key !== 'Backspace' || activeIndex === null) {
      return;
    }

    setOtpDigits(currentDigits => {
      const nextDigits = [...currentDigits];
      const deleteIndex = nextDigits[activeIndex]
        ? activeIndex
        : Math.max(activeIndex - 1, 0);
      nextDigits[deleteIndex] = '';
      setActiveIndex(deleteIndex);
      return nextDigits;
    });
    setOtpStatus(null);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== OTP_LENGTH) {
      return;
    }

    if (otp === DEMO_OTP) {
      setOtpStatus('success');
      Keyboard.dismiss();
      onVerified?.();
    } else {
      setOtpStatus('error');
    }
  };

  const handleResend = () => {
    if (secondsLeft === 0) {
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setActiveIndex(0);
      setOtpStatus(null);
      setSecondsLeft(RESEND_SECONDS);
      inputRef.current?.focus();
    }
  };

  const handleEditNumber = () => {
    Keyboard.dismiss();
    onBack();
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
          style={styles.formSheet}>
          <View style={styles.sheetSurface}>
            <View style={styles.dragHandle} />

            <View style={styles.formContent}>
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={12}
                onPress={handleEditNumber}
                style={styles.backButton}>
                <View style={styles.backArrow}>
                  <View style={styles.backArrowLine} />
                  <View style={styles.backArrowTop} />
                  <View style={styles.backArrowBottom} />
                </View>
              </Pressable>

              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.description}>
                We've sent a 6-digit OTP to
              </Text>
              <View style={styles.numberRow}>
                <Text style={styles.mobileNumber}>+91 {mobileNumber}</Text>
                <Pressable onPress={handleEditNumber} hitSlop={8}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.otpRow}>
                {Array.from({length: OTP_LENGTH}, (_, index) => (
                  <Pressable
                    accessibilityLabel={`OTP digit ${index + 1}`}
                    key={index}
                    onPress={() => handleOtpBoxPress(index)}
                    style={[
                      styles.otpBox,
                      otpStatus === 'error' && styles.otpBoxError,
                      otpStatus === 'success' && styles.otpBoxSuccess,
                      otpStatus === null &&
                        Boolean(otpDigits[index]) &&
                        otpDigits[index] === DEMO_OTP[index] &&
                        styles.otpBoxSuccess,
                      otpStatus === null &&
                        Boolean(otpDigits[index]) &&
                        otpDigits[index] !== DEMO_OTP[index] &&
                        styles.otpBoxError,
                      otpStatus === null &&
                        index === activeIndex &&
                        styles.otpBoxFocused,
                    ]}>
                    <View style={styles.otpValue}>
                      <Text style={styles.otpDigit}>
                        {otpDigits[index] || ''}
                      </Text>
                      {activeIndex === index && (
                        <View style={styles.otpCaret} />
                      )}
                    </View>
                  </Pressable>
                ))}
                <TextInput
                  ref={inputRef}
                  caretHidden
                  keyboardType="number-pad"
                  maxLength={1}
                  onChangeText={handleOtpChange}
                  onKeyPress={handleOtpKeyPress}
                  style={styles.hiddenInput}
                  value=""
                />
              </View>

              {otpStatus === 'error' && (
                <View style={styles.errorMessage}>
                  <View style={styles.errorIcon}>
                    <Text style={styles.errorIconText}>!</Text>
                  </View>
                  <Text style={styles.errorText}>
                    Invalid OTP. Please try again.
                  </Text>
                </View>
              )}

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Didn't receive the code?</Text>
                <Pressable disabled={secondsLeft > 0} onPress={handleResend}>
                  <Text style={styles.resendAction}>Resend OTP</Text>
                </Pressable>
                {secondsLeft > 0 && (
                  <Text style={styles.timer}>00:{String(secondsLeft).padStart(2, '0')}</Text>
                )}
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={otp.length !== OTP_LENGTH}
                onPress={handleVerifyOtp}
                style={({pressed}) => [
                  styles.verifyButton,
                  pressed && styles.verifyButtonPressed,
                ]}>
                <View style={styles.buttonSpacer} />
                <Text style={styles.buttonText}>Verify OTP</Text>
                <Text style={styles.arrow}>→</Text>
              </Pressable>
            </View>
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
  brandBlock: {marginLeft: 20, marginTop: 88, alignSelf: 'flex-start'},
  brand: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '400',
    letterSpacing: -1,
  },
  brandAccent: {color: '#4D32FF'},
  tagline: {color: '#C6CAE0', fontSize: 11, marginTop: 4},
  formSheet: {flex: 1, marginTop: -20},
  sheetSurface: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
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
  formContent: {paddingHorizontal: 16, paddingTop: 17},
  backButton: {width: 28, height: 26, justifyContent: 'center'},
  backArrow: {width: 24, height: 18, justifyContent: 'center'},
  backArrowLine: {
    width: 22,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#07113B',
  },
  backArrowTop: {
    position: 'absolute',
    left: 0,
    top: 3,
    width: 11,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#07113B',
    transform: [{rotate: '-45deg'}],
  },
  backArrowBottom: {
    position: 'absolute',
    left: 0,
    bottom: 3,
    width: 11,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#07113B',
    transform: [{rotate: '45deg'}],
  },
  title: {color: '#0A1237', fontSize: 20, fontWeight: '400', marginTop: 5},
  description: {color: '#686E8F', fontSize: 12, marginTop: 5},
  numberRow: {flexDirection: 'row', alignItems: 'center', marginTop: 3},
  mobileNumber: {color: '#10183B', fontSize: 13, fontWeight: '400'},
  editText: {color: '#4D32FF', fontSize: 12, marginLeft: 9},
  otpRow: {flexDirection: 'row', gap: 7, marginTop: 18, position: 'relative'},
  otpBox: {
    flex: 1,
    height: 53,
    borderWidth: 1,
    borderColor: '#DDE0EA',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFocused: {borderColor: '#BFC4DB'},
  otpBoxError: {borderColor: '#FF6572', backgroundColor: '#FFF9F9'},
  otpBoxSuccess: {borderColor: '#7485FF', backgroundColor: '#F6F7FF'},
  otpValue: {flexDirection: 'row', alignItems: 'center'},
  otpDigit: {color: '#080F31', fontSize: 19, fontWeight: '400'},
  otpCaret: {
    width: 1.5,
    height: 23,
    borderRadius: 1,
    backgroundColor: '#26336A',
    marginLeft: 3,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  errorMessage: {
    minHeight: 31,
    borderWidth: 1,
    borderColor: '#FFD3D7',
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    marginTop: 11,
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  resendLabel: {color: '#777D99', fontSize: 11},
  resendAction: {color: '#553BEE', fontSize: 11, marginLeft: 5},
  timer: {color: '#777D99', fontSize: 11, marginLeft: 10},
  verifyButton: {
    height: 48,
    borderRadius: 7,
    backgroundColor: '#050D35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    marginTop: 23,
  },
  verifyButtonPressed: {opacity: 0.88},
  buttonSpacer: {width: 20},
  buttonText: {color: '#FFFFFF', fontSize: 14, fontWeight: '400'},
  arrow: {color: '#FFFFFF', fontSize: 23, fontWeight: '400'},
});

export default OtpScreen;
