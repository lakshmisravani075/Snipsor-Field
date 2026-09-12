import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, AppState, FlatList, Image, Linking, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import {launchImageLibrary} from 'react-native-image-picker';
import {Camera, useCameraDevice, useCameraPermission, useCodeScanner} from 'react-native-vision-camera';
import LogoutScreen from '../profile/LogoutScreen.js';
import {activationService} from '../../services/apiService.js';
import {extractActivationSalons, mergeActivationDetails, normalizeActivationSalon} from './activationSalons.js';

const FILTERS = ['All', 'QR Pending', 'Training Pending', 'Ready Activation'];

const STATUS_STYLES = {
  'QR Pending': {backgroundColor: '#FFF7E9', color: '#D97508'},
  'Training Pending': {backgroundColor: '#FFF0E9', color: '#E9571D'},
  'Ready Activation': {backgroundColor: '#E7F8EF', color: '#128C57'},
};

const QR_SCAN_TIMEOUT_MS = 12000;
// KYC submission moves a salon into the activation queue asynchronously. A
// freshly opened queue can therefore briefly be empty even though the submit
// request already succeeded. Retry only that empty initial result; a non-empty
// list and all errors retain their existing behavior.
const EMPTY_QUEUE_RETRY_DELAYS_MS = [750, 1500];
const isTrainingCompletionStatusError = error => error?.status === 400
  && /invalid status for\s+training[_ ]completed/i.test(error?.message || '');
const QR_ERRORS = {
  api: {title: 'QR verification not saved', message: 'Unable to complete QR verification. Tap Scan Again to retry.'},
  camera: {title: 'Camera unavailable', message: 'The camera could not start. Tap Scan Again to retry.'},
  unclear: {
    title: 'QR code not clear',
    message: 'Unable to scan this QR code.',
    hint: 'Make sure the QR is clear and try again.',
  },
};

function SalonCard({salon, onPress}) {
  const badge = STATUS_STYLES[salon.status] || STATUS_STYLES['QR Pending'];
  const actionLabel = salon.status === 'QR Pending' ? 'Start Activation' : 'Continue Activation';
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} style={({pressed}) => [styles.cardMain, pressed && styles.pressed]}>
        <View style={styles.salonIconBox}>
          <Ionicons name="storefront-outline" size={31} color="#162A78" />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeadingRow}>
            <Text numberOfLines={1} style={styles.salonName}>{salon.name}</Text>
            <View style={[styles.badge, {backgroundColor: badge.backgroundColor}]}>
              <Text style={[styles.badgeText, {color: badge.color}]}>{salon.status}</Text>
            </View>
          </View>
          <Detail icon="location-outline" text={salon.address} />
          <Detail icon="person-outline" text={salon.owner} />
          <Detail icon="call-outline" text={salon.phone} />
          <Text style={styles.completedText}>{salon.date}</Text>
        </View>
        <Ionicons name="chevron-forward" size={23} color="#132B72" />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onPress} style={({pressed}) => [styles.cardActivationButton, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.cardActivationButtonText}>{actionLabel}</Text>
      </Pressable>
      <Text style={styles.cardSalonId}>Salon ID: {salon.displayId}</Text>
    </View>
  );
}

function ProgressStep({number, title, description, state, last, onPress}) {
  const isComplete = state === 'complete';
  const isPending = state === 'pending';
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({pressed}) => [styles.progressStep, pressed && styles.pressed]}>
      <View style={styles.stepRail}>
        <View style={[styles.stepCircle, (isComplete || isPending) && styles.stepCircleActive]}>
          {isComplete ? (
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          ) : (
            <Text style={[styles.stepNumber, isPending && styles.stepNumberActive]}>{number}</Text>
          )}
        </View>
        {!last && <View style={styles.stepLine} />}
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
      {isPending ? (
        <View style={styles.pendingBadge}><Text style={styles.pendingText}>Pending</Text></View>
      ) : !isComplete ? (
        <View style={styles.lockedBadge}>
          <Ionicons name="lock-closed" size={9} color="#61708F" />
          <Text style={styles.lockedText}>Locked</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function QrVerificationScreen({salon, onBack, onContinue, onVerified, onSessionExpired}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestVersion = useRef(0);
  useEffect(() => () => { requestVersion.current += 1; }, []);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  const [isScanning, setIsScanning] = useState(true);
  const [scannedValue, setScannedValue] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const isProcessingRef = useRef(false);
  const scanLinePosition = useRef(new Animated.Value(-90)).current;
  const {hasPermission, requestPermission} = useCameraPermission();
  const cameraDevice = useCameraDevice('back');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setIsForeground(state === 'active');
      if (state !== 'active') {
        setIsCameraReady(false);
        setIsTorchOn(false);
      }
    });
    return () => subscription.remove();
  }, []);
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: async codes => {
      // A native `onCodeScanned` event is itself proof that the camera is
      // ready. Waiting for the separately-rendered preview state can discard
      // the first scan before its state update has reached this closure.
      if (!isForeground || !isScanning || isProcessingRef.current) {
        return;
      }
      const qrCode = codes.find(code => code.type === 'qr');
      if (qrCode?.value?.trim()) {
        isProcessingRef.current = true;
        setIsScanning(false);
        setIsTorchOn(false);
        setScanError(null);
        if (!salon.id) {
          setScanError('api');
          Alert.alert('Salon ID unavailable', 'Unable to verify this salon. Please try again.');
          return;
        }
        const version = ++requestVersion.current;
        setIsSubmitting(true);
        try {
          const response = await activationService.completeQr(salon.id);
          if (version !== requestVersion.current) { return; }
          setScannedValue(qrCode.value);
          onVerified?.(response);
        } catch (error) {
          if (version !== requestVersion.current) { return; }
          setScanError('api');
          if (error?.status === 401) {
            Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
          } else {
            Alert.alert('Unable to verify QR', error?.message || 'Please try again.');
          }
        } finally {
          if (version === requestVersion.current) { setIsSubmitting(false); }
        }
      }
    },
  });

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  React.useEffect(() => {
    if (!hasPermission || !cameraDevice || !isScanning || !isCameraReady || !isForeground) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      isProcessingRef.current = true;
      setScanError('unclear');
      setIsScanning(false);
      setIsTorchOn(false);
    }, QR_SCAN_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [cameraDevice, hasPermission, isScanning, isCameraReady, isForeground]);

  React.useEffect(() => {
    if (!isScanning || !isCameraReady || !isForeground) {
      scanLinePosition.stopAnimation();
      return undefined;
    }
    const scanAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePosition, {toValue: 90, duration: 1600, useNativeDriver: true}),
        Animated.timing(scanLinePosition, {toValue: -90, duration: 1600, useNativeDriver: true}),
      ]),
    );
    scanAnimation.start();
    return () => scanAnimation.stop();
  }, [isScanning, isCameraReady, isForeground, scanLinePosition]);

  const handleScanAgain = () => {
    if (isSubmitting) { return; }
    setIsCameraReady(false);
    setIsTorchOn(false);
    setCameraSession(value => value + 1);
    isProcessingRef.current = false;
    setScannedValue(null);
    setScanError(null);
    setIsScanning(true);
  };
  const handleContinue = () => {
    if (!scannedValue) {
      Alert.alert('QR Verification Pending', 'Scan the correct salon QR code before continuing to training.');
      return;
    }
    onContinue?.();
  };
  const errorContent = scanError ? QR_ERRORS[scanError] : null;
  return (
    <SafeAreaView style={styles.qrScreen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.qrHeader}>
        <Pressable accessibilityLabel="Back to activation details" hitSlop={12} onPress={onBack} style={styles.detailHeaderButton}>
          <Ionicons name="arrow-back" size={24} color="#111936" />
        </Pressable>
        <Text style={styles.qrHeaderTitle}>QR Verification</Text>
      </View>
      <View style={styles.qrProgressTrack}>
        <View style={styles.qrProgressFill} />
      </View>
      <ScrollView contentContainerStyle={styles.qrContent} showsVerticalScrollIndicator={false}>
        <View style={styles.qrSalonCard}>
          <View style={styles.qrSalonIcon}>
            <Ionicons name="storefront-outline" size={29} color="#172B79" />
          </View>
          <View style={styles.qrSalonCopy}>
            <Text style={styles.qrSalonName}>{salon.name}</Text>
            <View style={styles.qrSalonDetail}>
              <Ionicons name="location-outline" size={12} color="#68718D" />
              <Text style={styles.qrSalonDetailText}>{salon.address}</Text>
            </View>
            <Text style={styles.qrSalonId}>Salon ID: {salon.displayId}</Text>
          </View>
        </View>
        <Text style={styles.qrTitle}>Verify Salon QR</Text>
        <Text style={styles.qrSubtitle}>Scan the salon QR code to verify and map it to this salon.</Text>
        <View style={styles.scannerBox}>
          <View collapsable={false} style={styles.scannerViewport}>
          {hasPermission && cameraDevice ? (
            <Camera
              key={cameraSession}
              androidPreviewViewType="texture-view"
              device={cameraDevice}
              isActive={isForeground}
              onPreviewStarted={() => setIsCameraReady(true)}
              onPreviewStopped={() => setIsCameraReady(false)}
              onError={() => {
                setIsCameraReady(false);
                setIsTorchOn(false);
                setIsScanning(false);
                setScanError('camera');
              }}
              codeScanner={codeScanner}
              resizeMode="cover"
              style={styles.scannerCameraPreview}
              torch={isTorchOn && isForeground && isCameraReady && cameraDevice.hasTorch ? 'on' : 'off'}
            />
          ) : (
            <Pressable onPress={requestPermission} style={styles.permissionButton}>
              <Ionicons name="camera-outline" size={32} color="#111936" />
              <Text style={styles.permissionText}>Allow Camera</Text>
            </Pressable>
          )}
          <View pointerEvents="none" style={styles.scanFrame}>
            <Animated.View style={[styles.scanLineOutline, {transform: [{translateY: scanLinePosition}]}]} />
            <Animated.View style={[styles.scanLine, {transform: [{translateY: scanLinePosition}]}]} />
            <View style={[styles.scanCornerOutline, styles.scanCornerOutlineTopLeft]} />
            <View style={[styles.scanCornerOutline, styles.scanCornerOutlineTopRight]} />
            <View style={[styles.scanCornerOutline, styles.scanCornerOutlineBottomLeft]} />
            <View style={[styles.scanCornerOutline, styles.scanCornerOutlineBottomRight]} />
            <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
          </View>
          </View>
        </View>
        {errorContent && (
          <View style={styles.qrErrorCard}>
            <View style={styles.qrErrorIcon}>
              <Ionicons name="alert" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.qrErrorCopy}>
              <Text style={styles.qrErrorTitle}>{errorContent.title}</Text>
              <Text style={styles.qrErrorMessage}>{errorContent.message}</Text>
              {errorContent.hint && <Text style={styles.qrErrorHint}>{errorContent.hint}</Text>}
            </View>
          </View>
        )}
        {scannedValue && (
          <View style={styles.verifiedSection}>
            <View style={styles.scanSuccess}>
              <Ionicons name="checkmark-circle" size={22} color="#13945B" />
              <View style={styles.scanSuccessCopy}>
                <Text style={styles.scanSuccessTitle}>QR Verified Successfully!</Text>
                <Text style={styles.scanSuccessValue}>This QR code is mapped to this salon</Text>
              </View>
              <View style={styles.mappedBadge}>
                <Text style={styles.mappedBadgeText}>Mapped</Text>
              </View>
            </View>
            <View style={styles.verifiedSalonCard}>
              <View style={styles.verifiedSalonIcon}>
                <Ionicons name="storefront-outline" size={26} color="#172B79" />
              </View>
              <View style={styles.verifiedSalonCopy}>
                <Text style={styles.verifiedSalonName}>{salon.name}</Text>
                <Text style={styles.verifiedSalonAddress}>{salon.address}</Text>
                <Text numberOfLines={1} style={styles.verifiedSalonId}>Salon ID: {salon.displayId}  •  QR ID: {scannedValue}</Text>
              </View>
            </View>
          </View>
        )}
        <Pressable disabled={!hasPermission || !isCameraReady || !isForeground} onPress={() => {
          if (!cameraDevice?.hasTorch) {
            Alert.alert('Flash unavailable', 'This camera does not have a flash.');
            return;
          }
          setIsTorchOn(value => !value);
        }} style={styles.flashButton}>
          <Ionicons name="flash-outline" size={15} color="#4932EF" />
          <Text style={styles.flashText}>{isTorchOn ? 'Turn off Flash' : 'Turn on Flash'}</Text>
        </Pressable>
        <View style={styles.checkCard}>
          <Text style={styles.checkTitle}>What to check?</Text>
          {['QR poster is displayed at the salon', 'QR code is clear and unbroken', 'QR code maps to the correct salon', 'Salon name matches after scanning'].map(item => (
            <View key={item} style={styles.checkRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#4932EF" />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.qrActionButtons}>
          {!isScanning && (
            <Pressable disabled={isSubmitting} onPress={handleScanAgain} style={({pressed}) => [styles.scanAgainButton, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={16} color="#102A72" />
              <Text style={styles.scanAgainText}>Scan Again</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={handleContinue}
            style={({pressed}) => [styles.continueTrainingButton, pressed && styles.pressed]}>
            <Text style={styles.continueTrainingText}>Continue to Training</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SelfieCamera({visible, onClose, onCaptured}) {
  const cameraRef = useRef(null);
  const frontCamera = useCameraDevice('front');
  const {hasPermission, requestPermission} = useCameraPermission();

  React.useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission, visible]);

  const takeSelfie = async () => {
    try {
      const photo = await cameraRef.current?.takePhoto({flash: 'off'});
      if (photo?.path) {
        onCaptured(`file://${photo.path}`);
      }
    } catch {
      Alert.alert('Unable to take selfie', 'Please try again.');
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent visible={visible}>
      <View style={styles.selfieCameraScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#050817" />
        <View style={styles.selfieCameraHeader}>
          <Pressable accessibilityLabel="Close selfie camera" hitSlop={12} onPress={onClose} style={styles.selfieCameraClose}>
            <Ionicons name="close" size={27} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.selfieCameraTitle}>Take Selfie</Text>
          <View style={styles.selfieCameraClose} />
        </View>
        {hasPermission && frontCamera ? (
          <Camera
            ref={cameraRef}
            device={frontCamera}
            isActive={visible}
            photo
            resizeMode="cover"
            style={styles.selfieCameraPreview}
          />
        ) : (
          <Pressable onPress={requestPermission} style={styles.selfiePermission}>
            <Ionicons name="camera-outline" size={38} color="#FFFFFF" />
            <Text style={styles.selfiePermissionText}>Allow Camera</Text>
          </Pressable>
        )}
        <View style={styles.selfieCameraControls}>
          <Pressable accessibilityLabel="Capture selfie" onPress={takeSelfie} style={styles.selfieCaptureOuter}>
            <View style={styles.selfieCaptureInner} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function TrainingScreen({salon, onBack, onCompleted, onSessionExpired}) {
  const [isTrainingCompleted, setIsTrainingCompleted] = useState(false);
  const [selfieUri, setSelfieUri] = useState(null);
  const [isSelfieCameraVisible, setIsSelfieCameraVisible] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyPickerResult = result => {
    if (result.errorMessage) {
      Alert.alert('Unable to upload selfie', result.errorMessage);
      return;
    }
    const asset = result.assets?.[0];
    if (asset?.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose a JPG or PNG photo up to 5 MB.');
      return;
    }
    if (!result.didCancel && !result.errorCode && asset?.uri) {
      setSelfieUri(asset.uri);
    }
  };

  const openCamera = () => setIsSelfieCameraVisible(true);

  const openGallery = async () => {
    try {
      const result = await launchImageLibrary({mediaType: 'photo', selectionLimit: 1, quality: 0.9});
      applyPickerResult(result);
    } catch {
      Alert.alert('Gallery unavailable', 'Please try again.');
    }
  };

  const chooseSelfie = () => {
    Alert.alert('Upload Selfie', 'Capture a selfie or select one from the gallery.', [
      {text: 'Take Selfie', onPress: openCamera},
      {text: 'Choose from Gallery', onPress: openGallery},
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const markCompleted = async () => {
    if (isSubmitting || !salon.id) { return; }
    setIsSubmitting(true);
    try {
      // The list can be stale after another device/user completes a step.
      // Always use the backend's current state before requesting a transition.
      const detailsResponse = await activationService.getSalonDetails(salon.id);
      const liveSalon = mergeActivationDetails(detailsResponse, salon);
      if (liveSalon.status === 'Ready Activation') {
        setIsTrainingCompleted(true);
        onCompleted?.(liveSalon);
        return;
      }
      if (liveSalon.status !== 'Training Pending') {
        Alert.alert(
          'Training cannot be completed',
          `The salon is currently at ${liveSalon.status || 'an unavailable'} activation status. Refresh the salon and complete the required previous step.`,
        );
        return;
      }
      await activationService.completeTraining(salon.id);
      setIsTrainingCompleted(true);
      onCompleted?.(liveSalon);
    } catch (error) {
      // A status-transition error is not proof that training has completed.
      // Re-read the salon from the API and advance only if its live status
      // confirms that the backend recorded the completion.
      if (isTrainingCompletionStatusError(error)) {
        try {
          const response = await activationService.getSalonDetails(salon.id);
          const liveSalon = mergeActivationDetails(response, salon);
          if (liveSalon.status === 'Ready Activation') {
            setIsTrainingCompleted(true);
            onCompleted?.(liveSalon);
            return;
          }
        } catch (statusError) {
          if (statusError?.status === 401) {
            Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
            return;
          }
        }
      }
      if (error?.status === 401) {
        Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
      } else {
        Alert.alert('Unable to complete training', error?.message || 'Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.trainingScreen}>
      <SelfieCamera
        visible={isSelfieCameraVisible}
        onClose={() => setIsSelfieCameraVisible(false)}
        onCaptured={uri => {
          setSelfieUri(uri);
          setIsSelfieCameraVisible(false);
        }}
      />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.qrHeader}>
        <Pressable accessibilityLabel="Back to activation details" hitSlop={12} onPress={onBack} style={styles.detailHeaderButton}>
          <Ionicons name="arrow-back" size={24} color="#111936" />
        </Pressable>
        <Text style={styles.qrHeaderTitle}>Training</Text>
      </View>
      <View style={styles.qrProgressTrack}>
        <View style={styles.trainingProgressFill} />
      </View>

      <ScrollView contentContainerStyle={styles.trainingContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trainingSalonCard}>
          <View style={styles.trainingSalonImage}>
            <Ionicons name="storefront-outline" size={34} color="#172B79" />
          </View>
          <View style={styles.trainingSalonCopy}>
            <Text style={styles.trainingSalonName}>{salon.name}</Text>
            <View style={styles.trainingMetaRow}>
              <Ionicons name="location-outline" size={12} color="#4932EF" />
              <Text style={styles.trainingMetaText}>{salon.address}</Text>
            </View>
            <View style={styles.trainingMetaRow}>
              <Ionicons name="git-branch-outline" size={12} color="#4932EF" />
              <Text style={styles.trainingMetaText}>Salon ID: {salon.displayId}</Text>
            </View>
            <View style={styles.trainingMetaRow}>
              <Ionicons name="person-outline" size={12} color="#4932EF" />
              <Text style={styles.trainingMetaText}>Owner: {salon.owner}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.trainingFormCard, isTrainingCompleted && styles.trainingFormCardCompleted]}>
          <Text style={styles.trainingSectionTitle}>Training Completed</Text>
          <Text style={styles.trainingSectionDescription}>Confirm that training has been completed with the salon owner/staff.</Text>
          <View style={styles.trainingToggleRow}>
            <Text style={styles.trainingToggleText}>Training completed with salon</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{checked: isTrainingCompleted}}
              onPress={() => setIsTrainingCompleted(value => !value)}
              style={[styles.trainingToggle, isTrainingCompleted && styles.trainingToggleActive]}>
              <View style={[styles.trainingToggleThumb, isTrainingCompleted && styles.trainingToggleThumbActive]} />
            </Pressable>
          </View>
        </View>

        <View style={styles.trainingFormCard}>
          <Text style={styles.trainingSectionTitle}>Upload Selfie with Salon Staff</Text>
          <Text style={styles.trainingSectionDescription}>Take a selfie with the salon owner or staff as proof of training completion.</Text>
          {selfieUri ? (
            <View style={styles.trainingSelfieWrap}>
              <Image source={{uri: selfieUri}} resizeMode="cover" style={styles.trainingSelfie} />
              <Pressable accessibilityLabel="Remove selfie" hitSlop={8} onPress={() => setSelfieUri(null)} style={styles.trainingDeletePhoto}>
                <Ionicons name="trash-outline" size={15} color="#38415F" />
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityLabel="Capture or upload selfie" accessibilityRole="button" onPress={chooseSelfie} style={({pressed}) => [styles.trainingUploadBox, pressed && styles.pressed]}>
              <View style={styles.trainingUploadIcon}>
                <Ionicons name="camera-outline" size={25} color="#6D51FF" />
                <Ionicons name="add" size={12} color="#6D51FF" style={styles.trainingUploadPlus} />
              </View>
              <Text style={styles.trainingUploadTitle}>Tap to capture or upload selfie</Text>
              <Text style={styles.trainingUploadHint}>JPG, PNG  •  Max 5 MB</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.trainingNoteLabel}>Note <Text style={styles.trainingOptional}>(Optional)</Text></Text>
        <View style={styles.trainingNoteBox}>
          <TextInput
            maxLength={150}
            multiline
            onChangeText={setNote}
            placeholder="Add a note about the training..."
            placeholderTextColor="#8A92A8"
            style={styles.trainingNoteInput}
            textAlignVertical="top"
            value={note}
          />
          <Text style={styles.trainingNoteCount}>{note.length}/150</Text>
        </View>

        <View style={styles.trainingActions}>
          <Pressable onPress={onBack} style={({pressed}) => [styles.trainingSaveButton, pressed && styles.pressed]}>
            <Text style={styles.trainingSaveText}>Save & Exit</Text>
          </Pressable>
          <Pressable disabled={isSubmitting} onPress={markCompleted} style={({pressed}) => [styles.trainingCompleteButton, pressed && styles.pressed]}>
            <Text style={styles.trainingCompleteText}>Mark Training Completed</Text>
          </Pressable>
        </View>

        {isTrainingCompleted && selfieUri && note.trim() && (
          <View style={styles.trainingInfoCard}>
            <Ionicons name="information-circle-outline" size={17} color="#6045EE" />
            <View style={styles.trainingInfoCopy}>
              <Text style={styles.trainingInfoTitle}>Why selfie is required?</Text>
              <Text style={styles.trainingInfoText}>This helps us verify that the training was done in person with the salon owner or staff.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivationResultScreen({salon, result, onBack, onGoToSalons}) {
  const isSuccess = result === 'success';
  const isRejected = result === 'rejected';
  const color = isSuccess ? '#0AA554' : '#EF2638';
  const icon = isSuccess ? 'checkmark' : 'close';
  const title = isSuccess ? 'Salon Activated Successfully!' : 'Salon Activation Rejected';
  const description = isSuccess
    ? 'Your salon has been activated successfully. You can now start managing your salon.'
    : "We're sorry, your salon activation request has been rejected.";

  return (
    <SafeAreaView style={styles.activationResultScreen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.activationResultHeader}>
        <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={onBack} style={styles.detailHeaderButton}>
          <Ionicons name="arrow-back" size={24} color="#111936" />
        </Pressable>
        <Text style={styles.activationResultHeaderTitle}>Activate Salon</Text>
        <View style={styles.detailHeaderButton} />
      </View>
      <ScrollView contentContainerStyle={styles.activationResultContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.activationResultIconHalo, {backgroundColor: `${color}12`}] }>
          <View style={[styles.activationResultIconCircle, {backgroundColor: color, borderColor: color}, isRejected && styles.activationResultIconRejected]}>
            <Ionicons name={icon} size={isSuccess ? 42 : 38} color={isRejected ? color : '#FFFFFF'} />
          </View>
        </View>
        <Text style={[styles.activationResultTitle, {color}]}>{title}</Text>
        <Text style={styles.activationResultDescription}>{description}</Text>

        {isSuccess && (
          <View style={styles.activationSuccessDetails}>
            <View style={styles.activationSuccessIcon}><Ionicons name="storefront-outline" size={32} color="#0AA554" /></View>
            <View style={styles.activationSuccessCopy}>
              <Text style={styles.activationResultFieldLabel}>Salon Name</Text>
              <Text style={styles.activationResultFieldValue}>{salon.name}</Text>
              <View style={styles.activationResultFieldDivider} />
              <Text style={styles.activationResultFieldLabel}>Salon ID</Text>
              <Text style={styles.activationResultFieldValue}>{salon.displayId}</Text>
            </View>
          </View>
        )}

        {isRejected && (
          <View style={styles.activationRejectedCard}>
            <Text style={styles.activationRejectedTitle}>Reason for Rejection</Text>
            <Text style={styles.activationRejectedText}>Document verification failed.{`\n`}Please upload valid documents and try again.</Text>
          </View>
        )}

      </ScrollView>

      <View style={styles.activationResultActions}>
        {isRejected && (
          <Pressable onPress={onBack} style={({pressed}) => [styles.activationResultPrimaryButton, pressed && styles.pressed]}>
            <Text style={styles.activationResultPrimaryText}>View Details</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onGoToSalons}
          style={({pressed}) => [isRejected ? styles.activationResultSecondaryButton : styles.activationResultPrimaryButton, pressed && styles.pressed]}>
          <Text style={isRejected ? styles.activationResultSecondaryText : styles.activationResultPrimaryText}>
            {isSuccess ? 'Go to Salons' : 'Back to Salons'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ReadyToActivateScreen({salon, qrVerified, trainingCompleted, onReadyCompleted, onBack, onGoToSalons, onCompleteSteps, onSessionExpired}) {
  const [isActivationConfirmed, setIsActivationConfirmed] = useState(false);
  const [activationResult, setActivationResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activateSalon = async () => {
    if (!isActivationConfirmed || isSubmitting) {
      return;
    }
    if (!qrVerified || !trainingCompleted) {
      onCompleteSteps?.();
      return;
    }
    if (!salon.id) { return; }
    setIsSubmitting(true);
    try {
      const response = await activationService.activateSalon(salon.id);
      onReadyCompleted?.(response);
      setActivationResult('success');
    } catch (error) {
      if (error?.status === 401) {
        Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
      } else {
        Alert.alert('Unable to activate salon', error?.message || 'Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activationResult) {
    return (
      <ActivationResultScreen
        salon={salon}
        result={activationResult}
        onBack={() => setActivationResult(null)}
        onGoToSalons={onGoToSalons}
      />
    );
  }

  return (
    <SafeAreaView style={styles.readyScreen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.qrHeader}>
        <Pressable accessibilityLabel="Back to training" hitSlop={12} onPress={onBack} style={styles.detailHeaderButton}>
          <Ionicons name="arrow-back" size={24} color="#111936" />
        </Pressable>
        <Text style={styles.qrHeaderTitle}>Ready to Activate</Text>
      </View>
      <View style={styles.qrProgressTrack}>
        <View style={styles.readyProgressFill} />
      </View>

      <ScrollView contentContainerStyle={styles.readyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.readySalonCard}>
          <View style={styles.readySalonImage}>
            <Ionicons name="storefront-outline" size={34} color="#172B79" />
          </View>
          <View style={styles.readySalonCopy}>
            <Text style={styles.readySalonName}>{salon.name}</Text>
            <View style={styles.readySalonMeta}>
              <Ionicons name="location-outline" size={12} color="#4932EF" />
              <Text style={styles.readySalonMetaText}>{salon.address}</Text>
            </View>
            <View style={styles.readyDetailsRow}>
              <View style={styles.readySalonMeta}>
                <Ionicons name="git-branch-outline" size={12} color="#4932EF" />
                <Text style={styles.readySalonMetaText}>Salon ID: {salon.displayId}</Text>
              </View>
              <View style={styles.readySalonMeta}>
                <Ionicons name="person-outline" size={12} color="#4932EF" />
                <Text style={styles.readySalonMetaText}>Owner: {salon.owner}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.readyReviewTitle}>Review & Confirm</Text>
        <Text style={styles.readyReviewDescription}>Please review the details before activating the salon.</Text>
        <View style={styles.readyReviewCard}>
          <View style={styles.readyReviewRow}>
            <View style={styles.readyReviewIcon}><Ionicons name="qr-code-outline" size={18} color="#5A38E8" /></View>
            <Text style={styles.readyReviewLabel}>QR Verification</Text>
            <Text style={styles.readyCompletedText}>Completed</Text>
            <Ionicons name="checkmark-circle" size={19} color="#1FA960" />
          </View>
          <View style={styles.readyReviewDivider} />
          <View style={styles.readyReviewRow}>
            <View style={styles.readyReviewIcon}><Ionicons name="school-outline" size={18} color="#5A38E8" /></View>
            <Text style={styles.readyReviewLabel}>Training</Text>
            <Text style={styles.readyCompletedText}>Completed</Text>
            <Ionicons name="checkmark-circle" size={19} color="#1FA960" />
          </View>
        </View>

        <View style={styles.readyInfoCard}>
          <Ionicons name="information-circle-outline" size={19} color="#5940E6" />
          <View style={styles.readyInfoCopy}>
            <Text style={styles.readyInfoTitle}>Once activated</Text>
            {['The salon will be live on Snipsor.', 'Bookings can be received from customers.', 'You can manage all operations from Snipsor Zone.'].map(item => (
              <View key={item} style={styles.readyInfoRow}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#5940E6" />
                <Text style={styles.readyInfoText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.readyActivateCard}>
          <View style={styles.readyActivateIcon}><Ionicons name="ribbon-outline" size={21} color="#13A35B" /></View>
          <View style={styles.readyActivateCopy}>
            <Text style={styles.readyActivateTitle}>Activate Salon</Text>
            <Text style={styles.readyActivateDescription}>Confirm to activate {salon.name} salon on Snipsor.</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked: isActivationConfirmed}}
            onPress={() => setIsActivationConfirmed(value => !value)}
            style={[styles.trainingToggle, isActivationConfirmed && styles.trainingToggleActive]}>
            <View style={[styles.trainingToggleThumb, isActivationConfirmed && styles.trainingToggleThumbActive]} />
          </Pressable>
        </View>

      </ScrollView>
      <View style={styles.readyActions}>
        <Pressable onPress={onBack} style={({pressed}) => [styles.readySaveButton, pressed && styles.pressed]}>
          <Text style={styles.readySaveText}>Save & Exit</Text>
        </Pressable>
        <Pressable
          disabled={!isActivationConfirmed || isSubmitting}
          onPress={activateSalon}
          style={({pressed}) => [styles.readyActivateButton, !isActivationConfirmed && styles.readyActivateButtonDisabled, pressed && styles.pressed]}>
          <Ionicons name="rocket-outline" size={16} color="#FFFFFF" />
          <Text style={styles.readyActivateButtonText}>{isSubmitting ? 'Activating...' : 'Activate Salon'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ActivationDetails({salon, onBack, onSessionExpired}) {
  const [showQrVerification, setShowQrVerification] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showReadyToActivate, setShowReadyToActivate] = useState(false);
  const [isQrVerified, setIsQrVerified] = useState(salon.status !== 'QR Pending');
  const [isTrainingCompleted, setIsTrainingCompleted] = useState(salon.status === 'Ready Activation');
  const [isReadyCompleted, setIsReadyCompleted] = useState(false);
  const currentStep = !isQrVerified ? 1 : !isTrainingCompleted ? 2 : 3;
  const isReadyToSubmit = salon.status === 'Ready Activation';
  const steps = [
    ['QR Verification', 'Scan and verify salon QR poster'],
    ['Training', 'Train owner / staff on Snipsor Zone'],
    ['Ready to Activate', 'Enable final activation after previous steps'],
  ];

  const handleCall = async () => {
    try {
      await Linking.openURL(`tel:${salon.phone.replace(/\s/g, '')}`);
    } catch {
      Alert.alert('Unable to call', 'The phone dialer could not be opened.');
    }
  };

  const handleNavigate = async () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salon.address)}`;
    try {
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert('Unable to navigate', 'Google Maps could not be opened.');
    }
  };

  const handleContinueActivation = () => {
    if (!isQrVerified) {
      setShowQrVerification(true);
      return;
    }
    if (!isTrainingCompleted) {
      setShowTraining(true);
      return;
    }
    setShowReadyToActivate(true);
  };

  if (showQrVerification) {
    return (
      <QrVerificationScreen
        salon={salon}
        onSessionExpired={onSessionExpired}
        onBack={() => setShowQrVerification(false)}
        onVerified={() => setIsQrVerified(true)}
        onContinue={() => {
          setShowQrVerification(false);
          setShowTraining(true);
        }}
      />
    );
  }

  if (showTraining) {
    return (
      <TrainingScreen
        salon={salon}
        onSessionExpired={onSessionExpired}
        onBack={() => setShowTraining(false)}
        onCompleted={() => {
          setIsTrainingCompleted(true);
          setShowTraining(false);
          setShowReadyToActivate(true);
        }}
      />
    );
  }

  if (showReadyToActivate) {
    return (
      <ReadyToActivateScreen
        salon={salon}
        onSessionExpired={onSessionExpired}
        qrVerified={isQrVerified}
        trainingCompleted={isTrainingCompleted}
        onReadyCompleted={() => setIsReadyCompleted(true)}
        onBack={() => setShowReadyToActivate(false)}
        onGoToSalons={onBack}
        onCompleteSteps={handleContinueActivation}
      />
    );
  }

  return (
    <SafeAreaView style={styles.detailScreen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.detailHeader}>
        <Pressable accessibilityLabel="Back to salons" hitSlop={12} onPress={onBack} style={styles.detailHeaderButton}>
          <Ionicons name="arrow-back" size={25} color="#111936" />
        </Pressable>
        <Text style={styles.detailHeaderTitle}>Activation Details</Text>
        <View style={styles.detailHeaderButton} />
      </View>
      <ScrollView style={styles.detailScrollView} contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileIconBox}>
              <Ionicons name="storefront-outline" size={43} color="#172B79" />
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.detailSalonName}>{salon.name}</Text>
              <View style={styles.verificationBadge}>
                <Ionicons name="time-outline" size={13} color="#E86320" />
                <Text style={styles.verificationText}>{salon.status === 'QR Pending' && !isQrVerified ? 'QR Verification Pending' : isQrVerified && salon.status === 'QR Pending' ? 'Training Pending' : salon.status}</Text>
              </View>
              <Detail icon="person-outline" text={salon.owner} large />
              <Detail icon="location-outline" text={salon.address} large />
              <Detail icon="call-outline" text={salon.phone} large />
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#188A4E" />
                <Text style={styles.completedBadgeText}>Onboarding Completed</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.profileMetaRow}>
            <View style={styles.profileMeta}>
              <Ionicons name="calendar-outline" size={15} color="#27324F" />
              <Text style={styles.profileMetaText}>{salon.date}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.profileMeta}>
              <Ionicons name="person-outline" size={15} color="#27324F" />
              <Text style={styles.profileMetaText}>Assigned to Priya Sharma</Text>
            </View>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={handleCall} style={styles.callButton}>
            <Ionicons name="call-outline" size={15} color="#102A72" />
            <Text style={styles.callButtonText}>Call</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleNavigate} style={styles.navigateButton}>
            <Ionicons name="navigate-outline" size={15} color="#FFFFFF" />
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </Pressable>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressHeadingRow}>
            <Text style={styles.progressHeading}>Activation Progress</Text>
            <Text style={styles.progressCount}>Step {currentStep} of 3</Text>
          </View>
          {steps.map(([title, description], index) => {
            const isComplete = [isQrVerified, isTrainingCompleted, isReadyCompleted][index];
            const isCurrent = index === currentStep - 1;
            const openStep = index === 0 ? () => setShowQrVerification(true) : index === 1 ? () => setShowTraining(true) : () => setShowReadyToActivate(true);
            return (
              <ProgressStep
                key={title}
                number={index + 1}
                title={title}
                description={description}
                state={isComplete ? 'complete' : isCurrent ? 'pending' : 'locked'}
                last={index === steps.length - 1}
                onPress={isComplete || isCurrent ? openStep : undefined}
              />
            );
          })}
        </View>
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={handleContinueActivation} style={({pressed}) => [styles.activationButton, pressed && styles.pressed]}>
        <Text style={styles.activationButtonText}>
          {isReadyToSubmit ? 'Submit Activation' : 'Continue Activation'}
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

function Detail({icon, text, large = false}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={large ? 14 : 11} color="#68718D" />
      <Text numberOfLines={1} style={[styles.detailText, large && styles.detailTextLarge]}>{text}</Text>
    </View>
  );
}

function BottomBar({onSalons, onProfile, activeTab = 'salons'}) {
  return (
    <View style={styles.bottomBar}>
      <Pressable onPress={onSalons} style={styles.navItem}>
        <Ionicons name="storefront-outline" size={23} color={activeTab === 'salons' ? '#4D32F4' : '#142354'} />
        <Text style={[styles.navLabel, activeTab === 'salons' && styles.navLabelActive]}>Salons</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onProfile} style={styles.navItem}>
        <Ionicons name="person-outline" size={23} color={activeTab === 'profile' ? '#4D32F4' : '#142354'} />
        <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>Profile</Text>
      </Pressable>
    </View>
  );
}

function ActivationScreen({onLogout}) {
  const detailsRequest = useRef(0);
  const isLoadingDetails = useRef(false);
  useEffect(() => () => { detailsRequest.current += 1; }, []);
  const openSalon = async item => {
    if (isLoadingDetails.current) { return; }
    isLoadingDetails.current = true;
    const requestId = ++detailsRequest.current;
    try {
      const response = await activationService.getSalonDetails(item.id);
      const details = mergeActivationDetails(response, item);
      if (requestId === detailsRequest.current) { setSelectedSalon(details); }
    } catch (error) {
      if (requestId !== detailsRequest.current) { return; }
      if (error?.status === 401) {
        Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onLogout}]);
        return;
      }
      Alert.alert('Unable to load salon details', error?.message || 'Please try again.', [
        {text: 'Cancel', style: 'cancel'}, {text: 'Retry', onPress: () => openSalon(item)},
      ]);
    } finally {
      isLoadingDetails.current = false;
    }
  };
  const [salons, setSalons] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  useEffect(() => {
    if (selectedSalon || showProfile) { return undefined; }
    let mounted = true;
    let retryTimeout;
    let emptyQueueRetry = 0;
    const loadSalons = async () => {
      if (!mounted) { return; }
      try {
        const response = await activationService.getSalons();
        const nextSalons = extractActivationSalons(response).map(normalizeActivationSalon);
        if (nextSalons.some(salon => !salon.id)) { throw new Error('A salon is missing its ID. Please try again.'); }
        if (!mounted) { return; }
        setSalons(nextSalons);
        const delay = EMPTY_QUEUE_RETRY_DELAYS_MS[emptyQueueRetry];
        if (!nextSalons.length && delay != null) {
          emptyQueueRetry += 1;
          retryTimeout = setTimeout(loadSalons, delay);
        }
      } catch (error) {
        if (!mounted) { return; }
        if (error?.status === 401) {
          Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onLogout}]);
          return;
        }
        Alert.alert('Unable to load salons', error?.message || 'Please try again.', [
          {text: 'Cancel', style: 'cancel'}, {text: 'Retry', onPress: loadSalons},
        ]);
      }
    };
    loadSalons();
    return () => {
      mounted = false;
      clearTimeout(retryTimeout);
    };
  }, [selectedSalon, showProfile, onLogout]);
  const filteredSalons = useMemo(
    () => activeFilter === 'All' ? salons : salons.filter(salon => salon.status === activeFilter),
    [activeFilter, salons],
  );

  if (showProfile) {
    return (
      <LogoutScreen
        onLogout={onLogout}
        onBack={() => setShowProfile(false)}
        bottomBar={<BottomBar activeTab="profile" onSalons={() => setShowProfile(false)} />}
      />
    );
  }

  if (selectedSalon) {
    return <ActivationDetails salon={selectedSalon} onBack={() => setSelectedSalon(null)} onSessionExpired={onLogout} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Snipsor <Text style={styles.brandAccent}>Field</Text></Text>
          <Text style={styles.pageTitle}>Salons</Text>
          <Text style={styles.subtitle}>Salons that completed onboarding</Text>
        </View>
        <Pressable
          accessibilityLabel="Search salons"
          hitSlop={10}
          onPress={() => setIsSearchActive(value => !value)}
          style={[styles.iconButton, isSearchActive && styles.iconButtonActive]}>
          <Ionicons name="search-outline" size={23} color="#172A70" />
        </Pressable>
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map(filter => {
          const selected = activeFilter === filter;
          return (
            <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterChip, selected && styles.filterChipActive]}>
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredSalons}
        keyExtractor={item => item.id}
        renderItem={({item}) => <SalonCard salon={item} onPress={() => openSalon(item)} />}
        showsVerticalScrollIndicator={false}
      />
      <BottomBar onProfile={() => setShowProfile(true)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 15, paddingBottom: 9},
  brand: {color: '#0F173B', fontFamily: 'Poppins_600SemiBold', fontSize: 15},
  brandAccent: {color: '#4D32F4'},
  pageTitle: {color: '#10183C', fontFamily: 'Poppins_600SemiBold', fontSize: 22, marginTop: 11},
  subtitle: {color: '#717891', fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2},
  iconButton: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4},
  iconButtonActive: {backgroundColor: '#F0EEFF'},
  filterRow: {backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingBottom: 10},
  filterChip: {minHeight: 26, borderWidth: 1, borderColor: '#D8DDE9', borderRadius: 6, justifyContent: 'center', paddingHorizontal: 9},
  filterChipActive: {backgroundColor: '#102158', borderColor: '#102158'},
  filterText: {color: '#242D50', fontFamily: 'Inter_500Medium', fontSize: 8},
  filterTextActive: {color: '#FFFFFF'},
  listContent: {paddingHorizontal: 14, paddingTop: 7, paddingBottom: 12, gap: 7},
  card: {minHeight: 127, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EF', borderRadius: 10, paddingTop: 9, paddingBottom: 7, overflow: 'hidden'},
  cardMain: {minHeight: 111, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10},
  cardActivationButton: {position: 'absolute', right: 10, bottom: 27, width: 139, height: 30, borderRadius: 6, backgroundColor: '#071F68', flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  cardActivationButtonText: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 8.5, textAlign: 'center'},
  cardSalonId: {position: 'absolute', left: 10, right: 10, bottom: 9, color: '#7A849B', fontFamily: 'Inter_400Regular', fontSize: 7.5, textAlign: 'center'},
  pressed: {opacity: 0.86},
  salonIconBox: {width: 49, height: 49, borderWidth: 1, borderColor: '#D8DFF1', borderRadius: 8, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center', marginRight: 10},
  cardContent: {flex: 1},
  cardHeadingRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  salonName: {flex: 1, color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 12},
  badge: {borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginLeft: 5},
  badgeText: {fontFamily: 'Inter_500Medium', fontSize: 7},
  detailRow: {flexDirection: 'row', alignItems: 'center', marginTop: 2},
  detailText: {flexShrink: 1, color: '#68718D', fontFamily: 'Inter_400Regular', fontSize: 8, marginLeft: 3},
  detailTextLarge: {fontSize: 11, marginLeft: 6},
  completedText: {color: '#69728E', fontFamily: 'Inter_400Regular', fontSize: 7.5, marginTop: 3, marginLeft: 14},
  bottomBar: {height: 64, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E6EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 52, paddingBottom: 2},
  navItem: {width: 82, alignItems: 'center', justifyContent: 'center'},
  navLabel: {color: '#142354', fontFamily: 'Inter_500Medium', fontSize: 9, marginTop: 2},
  navLabelActive: {color: '#4D32F4'},
  detailScreen: {flex: 1, backgroundColor: '#F7F8FC'},
  detailHeader: {height: 58, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14},
  detailHeaderButton: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  detailHeaderTitle: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 16},
  detailScrollView: {flex: 1},
  detailScroll: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24},
  profileCard: {backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EF', borderRadius: 15, padding: 13},
  profileTop: {flexDirection: 'row'},
  profileIconBox: {width: 72, height: 72, borderRadius: 13, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center', marginRight: 13},
  profileCopy: {flex: 1},
  detailSalonName: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 18},
  verificationBadge: {alignSelf: 'flex-start', minHeight: 22, borderWidth: 1, borderColor: '#FFC79E', borderRadius: 11, backgroundColor: '#FFF6ED', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginTop: 3, marginBottom: 5},
  verificationText: {color: '#DE5A1D', fontFamily: 'Inter_500Medium', fontSize: 9, marginLeft: 4},
  completedBadge: {alignSelf: 'flex-start', minHeight: 23, borderRadius: 5, backgroundColor: '#E7F8EC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, marginTop: 7},
  completedBadgeText: {color: '#167A48', fontFamily: 'Inter_500Medium', fontSize: 9, marginLeft: 4},
  profileDivider: {height: 1, backgroundColor: '#E5E8EF', marginTop: 13},
  profileMetaRow: {height: 39, flexDirection: 'row', alignItems: 'center'},
  profileMeta: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  profileMetaText: {color: '#39425D', fontFamily: 'Inter_400Regular', fontSize: 8.5, marginLeft: 7},
  metaDivider: {width: 1, height: 22, backgroundColor: '#E1E5EC'},
  actionRow: {flexDirection: 'row', gap: 9, marginTop: 10},
  callButton: {flex: 1, height: 37, borderWidth: 1, borderColor: '#12358A', borderRadius: 7, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  callButtonText: {color: '#102A72', fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 6},
  navigateButton: {flex: 1, height: 37, borderRadius: 7, backgroundColor: '#07308D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  navigateButtonText: {color: '#FFFFFF', fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 6},
  progressCard: {backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EF', borderRadius: 14, padding: 13, marginTop: 11},
  progressHeadingRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
  progressHeading: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 14},
  progressCount: {color: '#1645AE', fontFamily: 'Inter_500Medium', fontSize: 9},
  progressStep: {height: 67, borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingRight: 9, marginBottom: 7},
  stepRail: {width: 42, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center'},
  stepCircle: {width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: '#D3D8E3', backgroundColor: '#F4F5F8', alignItems: 'center', justifyContent: 'center', zIndex: 2},
  stepCircleActive: {backgroundColor: '#0D328E', borderColor: '#0D328E'},
  stepNumber: {color: '#5C657D', fontFamily: 'Inter_500Medium', fontSize: 11},
  stepNumberActive: {color: '#FFFFFF'},
  stepLine: {position: 'absolute', top: 46, width: 1, height: 42, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#BCC4D4'},
  stepCopy: {flex: 1},
  stepTitle: {color: '#18203B', fontFamily: 'Poppins_600SemiBold', fontSize: 11},
  stepDescription: {color: '#778096', fontFamily: 'Inter_400Regular', fontSize: 8.5, marginTop: 3},
  pendingBadge: {borderWidth: 1, borderColor: '#FFC692', borderRadius: 6, backgroundColor: '#FFF5E9', paddingHorizontal: 8, paddingVertical: 5},
  pendingText: {color: '#E55E18', fontFamily: 'Inter_500Medium', fontSize: 9},
  lockedBadge: {borderRadius: 5, backgroundColor: '#F1F3F7', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 5},
  lockedText: {color: '#61708F', fontFamily: 'Inter_500Medium', fontSize: 8.5, marginLeft: 4},
  activationButton: {height: 48, borderRadius: 8, backgroundColor: '#071F68', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 12, paddingHorizontal: 16},
  activationButtonText: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 13, marginRight: 9},
  selfieCameraScreen: {flex: 1, backgroundColor: '#050817'},
  selfieCameraHeader: {height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14},
  selfieCameraClose: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  selfieCameraTitle: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 16},
  selfieCameraPreview: {flex: 1},
  selfiePermission: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  selfiePermissionText: {color: '#FFFFFF', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 8},
  selfieCameraControls: {height: 126, alignItems: 'center', justifyContent: 'center'},
  selfieCaptureOuter: {width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  selfieCaptureInner: {width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF'},
  trainingScreen: {flex: 1, backgroundColor: '#F8F9FC'},
  trainingProgressFill: {width: '66.66%', height: '100%', backgroundColor: '#6D8FE8', borderRadius: 2},
  trainingContent: {paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24},
  trainingSalonCard: {minHeight: 92, borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', padding: 10},
  trainingSalonImage: {width: 68, height: 68, borderRadius: 8, backgroundColor: '#EEEAFE', alignItems: 'center', justifyContent: 'center'},
  trainingSalonCopy: {flex: 1, marginLeft: 11},
  trainingSalonName: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 13},
  trainingMetaRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  trainingMetaText: {flex: 1, color: '#53607B', fontFamily: 'Inter_400Regular', fontSize: 8.5, marginLeft: 5},
  trainingFormCard: {borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 10, backgroundColor: '#FFFFFF', padding: 12, marginTop: 11},
  trainingFormCardCompleted: {borderColor: '#CCEBDD', backgroundColor: '#F1FBF6'},
  trainingSectionTitle: {color: '#15203E', fontFamily: 'Poppins_600SemiBold', fontSize: 11},
  trainingSectionDescription: {color: '#65718B', fontFamily: 'Inter_400Regular', fontSize: 8.5, lineHeight: 13, marginTop: 4},
  trainingToggleRow: {height: 42, borderWidth: 1, borderColor: '#E0E4ED', borderRadius: 7, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 10},
  trainingToggleText: {color: '#303B5B', fontFamily: 'Inter_500Medium', fontSize: 8.5},
  trainingToggle: {width: 36, height: 20, borderRadius: 10, backgroundColor: '#D1D6E2', justifyContent: 'center', paddingHorizontal: 2},
  trainingToggleActive: {backgroundColor: '#5A38E8'},
  trainingToggleThumb: {width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF'},
  trainingToggleThumbActive: {alignSelf: 'flex-end'},
  trainingUploadBox: {height: 178, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A99AF7', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10},
  trainingUploadIcon: {width: 53, height: 53, borderRadius: 27, backgroundColor: '#F3F0FF', alignItems: 'center', justifyContent: 'center'},
  trainingUploadPlus: {position: 'absolute', right: 9, bottom: 9, backgroundColor: '#FFFFFF', borderRadius: 6},
  trainingUploadTitle: {color: '#283456', fontFamily: 'Inter_500Medium', fontSize: 9, marginTop: 12},
  trainingUploadHint: {color: '#8A91A6', fontFamily: 'Inter_400Regular', fontSize: 7.5, marginTop: 5},
  trainingSelfieWrap: {height: 190, borderRadius: 8, overflow: 'hidden', marginTop: 10},
  trainingSelfie: {width: '100%', height: '100%'},
  trainingDeletePhoto: {position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  trainingNoteLabel: {color: '#222D4B', fontFamily: 'Poppins_600SemiBold', fontSize: 9, marginTop: 12, marginLeft: 2},
  trainingOptional: {color: '#7E879C', fontFamily: 'Inter_400Regular'},
  trainingNoteBox: {height: 92, borderWidth: 1, borderColor: '#DDE2EC', borderRadius: 8, backgroundColor: '#FFFFFF', marginTop: 6},
  trainingNoteInput: {flex: 1, color: '#1B2543', fontFamily: 'Inter_400Regular', fontSize: 9, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 22},
  trainingNoteCount: {position: 'absolute', right: 9, bottom: 7, color: '#6E7891', fontFamily: 'Inter_400Regular', fontSize: 7.5},
  trainingActions: {flexDirection: 'row', gap: 9, marginTop: 12},
  trainingSaveButton: {width: 105, height: 42, borderWidth: 1, borderColor: '#173B91', borderRadius: 7, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  trainingSaveText: {color: '#102A72', fontFamily: 'Inter_500Medium', fontSize: 9.5},
  trainingCompleteButton: {flex: 1, height: 36, borderRadius: 7, backgroundColor: '#2F1A9F', alignItems: 'center', justifyContent: 'center', alignSelf: 'center'},
  trainingCompleteText: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 9},
  trainingInfoCard: {borderWidth: 1, borderColor: '#E3DDFE', borderRadius: 8, backgroundColor: '#F8F6FF', flexDirection: 'row', alignItems: 'flex-start', padding: 10, marginTop: 12},
  trainingInfoCopy: {flex: 1, marginLeft: 7},
  trainingInfoTitle: {color: '#4932B8', fontFamily: 'Poppins_600SemiBold', fontSize: 8.5},
  trainingInfoText: {color: '#68718D', fontFamily: 'Inter_400Regular', fontSize: 7.5, lineHeight: 11, marginTop: 2},
  readyScreen: {flex: 1, backgroundColor: '#F8F9FC'},
  readyProgressFill: {width: '100%', height: '100%', backgroundColor: '#6D8FE8', borderRadius: 2},
  readyContent: {paddingHorizontal: 16, paddingTop: 13, paddingBottom: 24},
  readySalonCard: {minHeight: 96, borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', padding: 11},
  readySalonImage: {width: 70, height: 70, borderRadius: 8, backgroundColor: '#EEEAFE', alignItems: 'center', justifyContent: 'center'},
  readySalonCopy: {flex: 1, marginLeft: 12},
  readySalonName: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 14},
  readySalonMeta: {flexDirection: 'row', alignItems: 'center', marginTop: 5},
  readySalonMetaText: {color: '#53607B', fontFamily: 'Inter_400Regular', fontSize: 8, marginLeft: 5},
  readyDetailsRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  readyReviewTitle: {color: '#141E3B', fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginTop: 14},
  readyReviewDescription: {color: '#69738C', fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 3},
  readyReviewCard: {borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 9, backgroundColor: '#FFFFFF', marginTop: 9, overflow: 'hidden'},
  readyReviewRow: {height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11},
  readyReviewIcon: {width: 31, height: 31, borderRadius: 6, backgroundColor: '#F1EEFF', alignItems: 'center', justifyContent: 'center'},
  readyReviewLabel: {flex: 1, color: '#202B49', fontFamily: 'Inter_500Medium', fontSize: 9.5, marginLeft: 9},
  readyCompletedText: {color: '#179553', fontFamily: 'Inter_500Medium', fontSize: 8.5, marginRight: 8},
  readyReviewDivider: {height: 1, backgroundColor: '#E8EAF0', marginLeft: 51},
  readyInfoCard: {borderWidth: 1, borderColor: '#E3DDFD', borderRadius: 9, backgroundColor: '#F6F3FF', flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginTop: 12},
  readyInfoCopy: {flex: 1, marginLeft: 8},
  readyInfoTitle: {color: '#313B5B', fontFamily: 'Poppins_600SemiBold', fontSize: 10},
  readyInfoRow: {flexDirection: 'row', alignItems: 'center', marginTop: 5},
  readyInfoText: {color: '#59657F', fontFamily: 'Inter_400Regular', fontSize: 8, marginLeft: 6},
  readyActivateCard: {minHeight: 70, borderWidth: 1, borderColor: '#D9EFE3', borderRadius: 9, backgroundColor: '#F0FAF5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginTop: 12},
  readyActivateIcon: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#DDF5E8', alignItems: 'center', justifyContent: 'center'},
  readyActivateCopy: {flex: 1, marginLeft: 9},
  readyActivateTitle: {color: '#17213E', fontFamily: 'Poppins_600SemiBold', fontSize: 10.5},
  readyActivateDescription: {color: '#66728A', fontFamily: 'Inter_400Regular', fontSize: 7.5, marginTop: 3},
  readySuccessCard: {minHeight: 45, borderWidth: 1, borderColor: '#CBE9D8', borderRadius: 8, backgroundColor: '#ECF9F2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginTop: 10},
  readySuccessText: {flex: 1, color: '#16814E', fontFamily: 'Inter_500Medium', fontSize: 8.5, marginLeft: 8},
  readyActions: {flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#E3E6EE', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12},
  readySaveButton: {flex: 1, height: 43, borderWidth: 1, borderColor: '#173B91', borderRadius: 7, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  readySaveText: {color: '#102A72', fontFamily: 'Inter_500Medium', fontSize: 9.5},
  readyActivateButton: {flex: 1.15, height: 43, borderRadius: 7, backgroundColor: '#2F1A9F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  readyActivateButtonDisabled: {opacity: 0.45},
  readyActivateButtonText: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 9.5, marginLeft: 7},
  activationResultScreen: {flex: 1, backgroundColor: '#FFFFFF'},
  activationResultHeader: {height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14},
  activationResultHeaderTitle: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 15},
  activationResultContent: {flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 34, paddingBottom: 22},
  activationResultIconHalo: {width: 122, height: 122, borderRadius: 61, alignItems: 'center', justifyContent: 'center'},
  activationResultIconCircle: {width: 66, height: 66, borderRadius: 33, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  activationResultIconRejected: {backgroundColor: 'transparent'},
  activationResultTitle: {maxWidth: 245, fontFamily: 'Poppins_600SemiBold', fontSize: 20, lineHeight: 28, textAlign: 'center', marginTop: 20},
  activationResultDescription: {maxWidth: 280, color: '#5F6983', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 12},
  activationSuccessDetails: {width: '100%', minHeight: 126, borderRadius: 10, backgroundColor: '#EDFAF4', flexDirection: 'row', alignItems: 'flex-start', padding: 16, marginTop: 27},
  activationSuccessIcon: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  activationSuccessCopy: {flex: 1, marginLeft: 12},
  activationResultFieldLabel: {color: '#202A48', fontFamily: 'Poppins_600SemiBold', fontSize: 10},
  activationResultFieldValue: {color: '#44516D', fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3},
  activationResultFieldDivider: {height: 1, backgroundColor: '#D7EBE0', marginVertical: 10},
  activationRejectedCard: {width: '100%', borderRadius: 10, backgroundColor: '#FFF0F2', padding: 16, marginTop: 26},
  activationRejectedTitle: {color: '#E52637', fontFamily: 'Poppins_600SemiBold', fontSize: 11},
  activationRejectedText: {color: '#45516C', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20, marginTop: 8},
  activationPendingCard: {width: '100%', borderWidth: 1, borderColor: '#ECEEF3', borderRadius: 10, backgroundColor: '#FFFFFF', padding: 12, marginTop: 24},
  activationPendingTitle: {color: '#F07D0A', fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginBottom: 5},
  activationPendingRow: {height: 48, flexDirection: 'row', alignItems: 'center'},
  activationPendingIcon: {width: 31, height: 31, borderRadius: 6, backgroundColor: '#F0EDFF', alignItems: 'center', justifyContent: 'center'},
  activationPendingLabel: {flex: 1, color: '#33405D', fontFamily: 'Inter_500Medium', fontSize: 10, marginLeft: 10},
  activationPendingBadge: {borderRadius: 6, backgroundColor: '#FFF2E3', paddingHorizontal: 9, paddingVertical: 5},
  activationPendingBadgeText: {color: '#EF7800', fontFamily: 'Inter_500Medium', fontSize: 8},
  activationResultActions: {borderTopWidth: 1, borderTopColor: '#EEF0F4', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 13, gap: 9},
  activationResultPrimaryButton: {height: 45, borderRadius: 7, backgroundColor: '#3219B6', alignItems: 'center', justifyContent: 'center'},
  activationResultPrimaryText: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11},
  activationResultSecondaryButton: {height: 45, borderWidth: 1, borderColor: '#4932EF', borderRadius: 7, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  activationResultSecondaryText: {color: '#3822B4', fontFamily: 'Poppins_600SemiBold', fontSize: 11},
  qrScreen: {flex: 1, backgroundColor: '#FFFFFF'},
  qrHeader: {height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#EEF0F5'},
  qrHeaderTitle: {flex: 1, color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 15, marginLeft: 4},
  qrProgressTrack: {height: 4, backgroundColor: '#E2E7F2', marginHorizontal: 10, borderRadius: 2, overflow: 'hidden'},
  qrProgressFill: {width: '33.33%', height: '100%', backgroundColor: '#6D8FE8', borderRadius: 2},
  qrContent: {paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24},
  qrSalonCard: {minHeight: 76, borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', padding: 10},
  qrSalonIcon: {width: 52, height: 52, borderRadius: 8, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'},
  qrSalonCopy: {flex: 1, marginLeft: 11},
  qrSalonName: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 13},
  qrSalonDetail: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  qrSalonDetailText: {color: '#68718D', fontFamily: 'Inter_400Regular', fontSize: 9, marginLeft: 4},
  qrSalonId: {color: '#44537A', fontFamily: 'Inter_500Medium', fontSize: 8, marginTop: 5},
  qrTitle: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 17, textAlign: 'center', marginTop: 18},
  qrSubtitle: {color: '#68718D', fontFamily: 'Inter_400Regular', fontSize: 9.5, lineHeight: 14, textAlign: 'center', marginTop: 3, paddingHorizontal: 55},
  scannerBox: {height: 360, width: '100%', alignSelf: 'center', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 14, overflow: 'hidden'},
  scannerViewport: {width: 246, height: 246, position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  scannerCameraPreview: {position: 'absolute', top: 0, left: 0, width: 246, height: 246},
  permissionButton: {alignItems: 'center', justifyContent: 'center'},
  permissionText: {color: '#111936', fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 7},
  scanFrame: {position: 'absolute', top: 13, right: 13, bottom: 13, left: 13},
  scanLineOutline: {position: 'absolute', left: 7, right: 7, top: '50%', height: 4, marginTop: -2, borderRadius: 2, backgroundColor: 'rgba(17, 25, 54, 0.45)'},
  scanLine: {position: 'absolute', left: 8, right: 8, top: '50%', height: 2, marginTop: -1, backgroundColor: '#FFFFFF', shadowColor: '#FFFFFF', shadowOpacity: 0.45, shadowRadius: 5, elevation: 3},
  scanCornerOutline: {position: 'absolute', width: 32, height: 32, borderColor: 'rgba(17, 25, 54, 0.55)'},
  scanCornerOutlineTopLeft: {left: 0, top: 0, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 7},
  scanCornerOutlineTopRight: {right: 0, top: 0, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 7},
  scanCornerOutlineBottomLeft: {left: 0, bottom: 0, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 7},
  scanCornerOutlineBottomRight: {right: 0, bottom: 0, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 7},
  scanCorner: {position: 'absolute', width: 30, height: 30},
  scanCornerTopLeft: {left: 1, top: 1, borderColor: '#FFFFFF', borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 6},
  scanCornerTopRight: {right: 1, top: 1, borderColor: '#FFFFFF', borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 6},
  scanCornerBottomLeft: {left: 1, bottom: 1, borderColor: '#FFFFFF', borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 6},
  scanCornerBottomRight: {right: 1, bottom: 1, borderColor: '#FFFFFF', borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 6},
  qrErrorCard: {minHeight: 72, borderWidth: 1, borderColor: '#FFD2D5', borderRadius: 9, backgroundColor: '#FFF5F5', flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 11, marginTop: 10},
  qrErrorIcon: {width: 27, height: 27, borderRadius: 14, backgroundColor: '#EF3E49', alignItems: 'center', justifyContent: 'center', marginTop: 1},
  qrErrorCopy: {flex: 1, marginLeft: 10},
  qrErrorTitle: {color: '#E53F49', fontFamily: 'Poppins_600SemiBold', fontSize: 10},
  qrErrorMessage: {color: '#435078', fontFamily: 'Inter_400Regular', fontSize: 8.5, marginTop: 3},
  qrErrorHint: {color: '#435078', fontFamily: 'Inter_500Medium', fontSize: 8.5, marginTop: 4},
  flashButton: {height: 35, alignSelf: 'center', borderWidth: 1, borderColor: '#D8DDF0', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, marginTop: 10},
  flashText: {color: '#4932EF', fontFamily: 'Inter_500Medium', fontSize: 9, marginLeft: 6},
  scanSuccess: {minHeight: 52, borderWidth: 1, borderColor: '#CDEDDD', borderRadius: 8, backgroundColor: '#ECFAF2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginTop: 10},
  scanSuccessCopy: {flex: 1, marginLeft: 8},
  scanSuccessTitle: {color: '#13824F', fontFamily: 'Poppins_600SemiBold', fontSize: 10},
  scanSuccessValue: {color: '#529072', fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 2},
  verifiedSection: {marginTop: 10},
  mappedBadge: {borderRadius: 5, backgroundColor: '#DDF5E7', paddingHorizontal: 9, paddingVertical: 5},
  mappedBadgeText: {color: '#16824E', fontFamily: 'Inter_500Medium', fontSize: 8},
  verifiedSalonCard: {minHeight: 65, borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', padding: 8, marginTop: 7},
  verifiedSalonIcon: {width: 47, height: 47, borderRadius: 7, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'},
  verifiedSalonCopy: {flex: 1, marginLeft: 9},
  verifiedSalonName: {color: '#111936', fontFamily: 'Poppins_600SemiBold', fontSize: 10},
  verifiedSalonAddress: {color: '#68718D', fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 2},
  verifiedSalonId: {color: '#44537A', fontFamily: 'Inter_400Regular', fontSize: 7, marginTop: 3},
  checkCard: {borderRadius: 9, backgroundColor: '#F7F8FC', padding: 12, marginTop: 13},
  checkTitle: {color: '#17203B', fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginBottom: 6},
  checkRow: {flexDirection: 'row', alignItems: 'center', marginTop: 5},
  checkText: {color: '#59657F', fontFamily: 'Inter_400Regular', fontSize: 8.5, marginLeft: 7},
  qrActionButtons: {marginTop: 11},
  scanAgainButton: {height: 42, borderWidth: 1, borderColor: '#173B91', borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  scanAgainText: {color: '#102A72', fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 7},
  continueTrainingButton: {height: 44, borderRadius: 7, backgroundColor: '#071F68', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 9},
  continueTrainingText: {color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginRight: 8},
});

export default ActivationScreen;
