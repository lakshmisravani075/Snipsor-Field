import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Image,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {deleteSalonImage, getSalonImages, MAX_IMAGE_SIZE, uploadSalonImage} from '../../../services/onboardingImages';

const uploadIcon = require('../../../assets/icons/files-media-upload.png');
const cameraIcon = require('../../../assets/icons/files-media-camera.png');
const galleryIcon = require('../../../assets/icons/files-media-gallery.png');
const filesIcon = require('../../../assets/icons/files-media-files.png');
const MAX_FILE_SIZE = MAX_IMAGE_SIZE;

function FilesMediaScreen({salonId, initialPhotos = [], onImagesChanged, onBack, onSave}) {
  const [photos, setPhotos] = useState([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const drafts = useRef(initialPhotos.filter(photo => !photo.uploaded && /^(file:|content:|blob:|data:)/.test(photo.uri || '')));
  const changed = useRef(onImagesChanged);
  changed.current = onImagesChanged;
  const canContinue = photos.length >= 1 && !busy && !loadFailed;
  const allUploaded = photos.length > 0 && photos.every(photo => photo.uploaded);

  const updatePhotos = next => {
    setPhotos(next);
    changed.current?.(next);
  };

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const load = async () => {
      if (!active) { return; }
      setBusy(true);
      setLoadFailed(false);
      try {
        const saved = await getSalonImages(salonId);
        if (!active) { return; }
        const remaining = drafts.current.filter(photo => !saved.some(image => image.uri === photo.uploadedUrl));
        const next = [...saved, ...remaining.slice(0, Math.max(0, 5 - saved.length))];
        setPhotos(next);
        changed.current?.(next);
      } catch (error) {
        if (!active) { return; }
        setLoadFailed(true);
        changed.current?.([]);
        Alert.alert('Unable to load salon images', error?.message || 'Please try again.', [
          {text: 'Cancel', style: 'cancel'}, {text: 'Retry', onPress: load},
        ]);
      } finally {
        if (active) { setBusy(false); }
      }
    };
    load();
    return () => { active = false; mounted.current = false; };
  }, [salonId]);

  const save = async () => {
    if (!canContinue || pending.current) { return; }
    pending.current = true;
    setBusy(true);
    let current = [...photos];
    try {
      for (const photo of photos.filter(item => !item.uploaded)) {
        const saved = await uploadSalonImage(salonId, photo, uploadedUrl => {
          current = current.map(item => item.id === photo.id ? {...item, uploadedUrl} : item);
          if (mounted.current) { updatePhotos(current); }
        });
        current = current.map(item => item.id === photo.id ? saved : item);
        if (!mounted.current) { return; }
        updatePhotos(current);
      }
      const saved = await getSalonImages(salonId);
      if (!saved.length || !current.every(photo => saved.some(image => image.id === photo.id))) {
        throw new Error('The server has not saved all selected images. Please retry.');
      }
      if (mounted.current) { updatePhotos(saved); onSave(saved); }
    } catch (error) {
      if (mounted.current) { Alert.alert('Unable to save salon images', error?.message || 'Please try again.'); }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(false); }
    }
  };

  const removePhoto = async photo => {
    if (busy || pending.current || loadFailed) { return; }
    if (!photo.uploaded) { updatePhotos(photos.filter(item => item.id !== photo.id)); return; }
    pending.current = true;
    setBusy(true);
    try {
      const saved = await deleteSalonImage(salonId, photo.id);
      if (saved.some(item => item.id === photo.id)) { throw new Error('The server did not remove this image. Please retry.'); }
      if (mounted.current) { updatePhotos([...saved, ...photos.filter(item => !item.uploaded)]); }
    } catch (error) {
      if (mounted.current) { Alert.alert('Unable to remove photo', error?.message || 'Please try again.'); }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(false); }
    }
  };

  const savePickedPhotos = assets => {
    if (!mounted.current) { return; }
    const validAssets = assets.filter(asset => asset.uri && (!asset.fileSize || asset.fileSize <= MAX_FILE_SIZE));
    if (validAssets.length !== assets.length) {
      Alert.alert('File too large', 'Please choose JPG or PNG photos up to 5 MB each.');
    }
    const additions = validAssets.map((asset, index) => ({
      id: `${Date.now()}-${index}`,
      uri: asset.uri,
      name: asset.fileName || asset.name || `salon-photo-${index + 1}`,
      type: asset.type || asset.mimeType || (/\.png$/i.test(asset.fileName || asset.name || '') ? 'image/png' : /\.jpe?g$/i.test(asset.fileName || asset.name || '') ? 'image/jpeg' : undefined),
      uploaded: false,
    }));
    updatePhotos([...photos, ...additions].slice(0, 5));
  };

  const openPhotoSource = async source => {
    if (busy || loadFailed) { return; }
    setSourceOpen(false);
    try {
      if (source === 'Camera') {
        if (Platform.OS === 'android') {
          const cameraPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera permission',
              message: 'Allow Snipsor Field to take salon photos.',
              buttonPositive: 'Allow',
              buttonNegative: 'Cancel',
            },
          );
          if (cameraPermission !== PermissionsAndroid.RESULTS.GRANTED) {
            return;
          }
        }
        const response = await launchCamera({mediaType: 'photo', quality: 0.9});
        if (response.errorMessage) {
          Alert.alert('Camera unavailable', response.errorMessage);
        } else if (!response.didCancel) {
          savePickedPhotos(response.assets || []);
        }
        return;
      }
      if (source === 'Gallery') {
        const response = await launchImageLibrary({mediaType: 'photo', selectionLimit: 5});
        if (response.errorMessage) {
          Alert.alert('Gallery unavailable', response.errorMessage);
        } else if (!response.didCancel) {
          savePickedPhotos(response.assets || []);
        }
        return;
      }
      const selectedFiles = await NativeModules.FilePicker.pickImages();
      savePickedPhotos(selectedFiles.map(file => ({...file, fileName: file.name, fileSize: file.size})));
    } catch (error) {
      Alert.alert('Unable to open files', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Pressable disabled={busy} accessibilityLabel="Go back" hitSlop={12} onPress={onBack} style={styles.backButton}><Text style={styles.backArrow}>←</Text></Pressable>
        <Text style={styles.headerTitle}>Salon Images</Text>
      </View>
      <View style={styles.progressArea}>
        <Text style={styles.stepText}>Step 2 of 8</Text>
        <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload salon photos</Text>

          <Pressable disabled={busy || loadFailed || photos.length >= 5} onPress={() => setSourceOpen(true)} style={styles.uploadBox}>
            <View style={styles.uploadIconCircle}><Image source={uploadIcon} resizeMode="contain" style={styles.uploadIcon} /></View>
            <Text style={styles.uploadHint}>Upload the main photo customers{`\n`}will see first.</Text>
            <View style={styles.uploadButton}><Text style={styles.uploadButtonText}>Tap to upload</Text></View>
          </Pressable>

          {photos.length > 0 && <Text style={styles.galleryTitle}>Salon gallery</Text>}
          {photos.length > 0 && (
            <View style={styles.gallery}>
              {photos.map((photo, index) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image source={{uri: photo.uri}} resizeMode="cover" style={styles.photoPreview} />
                  <Pressable disabled={busy || loadFailed} accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => removePhoto(photo)} style={styles.removeButton}><Text style={styles.removeText}>×</Text></Pressable>
                  {photo.uploaded && <View style={styles.photoCheck}><Text style={styles.photoCheckText}>✓</Text></View>}
                </View>
              ))}
              {photos.length < 5 && <Pressable disabled={busy || loadFailed} onPress={() => setSourceOpen(true)} style={styles.addTile}><Text style={styles.addText}>＋</Text></Pressable>}
            </View>
          )}

          <Text style={styles.requirement}>Add at least 1 photo. JPG, PNG up to 5 MB each.</Text>
          <View style={[styles.infoBox, allUploaded && styles.successBox]}>
            <Text style={[styles.infoIcon, allUploaded && styles.successText]}>ⓘ</Text>
            <Text style={[styles.infoText, allUploaded && styles.successText]}>{allUploaded ? `${photos.length} images uploaded. Looks great! Your salon profile feels more complete.` : 'Tip: Great photos help customers trust your business and book with confidence.'}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable disabled={busy} onPress={onBack} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        <Pressable disabled={!canContinue} onPress={save} style={[styles.saveButton, !canContinue && styles.saveDisabled]}><Text style={[styles.saveText, !canContinue && styles.saveTextDisabled]}>{busy ? 'Please wait...' : 'Save & Continue'}</Text></Pressable>
      </View>

      <Modal animationType="slide" transparent visible={sourceOpen} onRequestClose={() => setSourceOpen(false)}>
        <Pressable onPress={() => setSourceOpen(false)} style={styles.modalShade}>
          <Pressable onPress={() => {}} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose photo source</Text>
            {[['Camera', cameraIcon], ['Gallery', galleryIcon], ['Files', filesIcon]].map(([label, icon]) => (
              <Pressable key={label} onPress={() => openPhotoSource(label)} style={styles.sourceRow}><View style={styles.sourceIconBox}><Image source={icon} resizeMode="contain" style={styles.sourceIcon} /></View><Text style={styles.sourceText}>{label}</Text></Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6F7FB'},
  header: {height: 55, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14},
  backButton: {width: 30, height: 40, justifyContent: 'center', marginRight: 9},
  backArrow: {color: '#FFFFFF', fontSize: 19, lineHeight: 24},
  headerTitle: {color: '#FFFFFF', fontSize: 17, fontFamily: 'Poppins_600SemiBold'},
  progressArea: {backgroundColor: '#07113D', paddingHorizontal: 20, paddingBottom: 15},
  stepText: {color: '#FFFFFF', fontSize: 12, fontWeight: '500', marginBottom: 9},
  progressTrack: {height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: '#61749C'},
  progressFill: {height: '100%', width: '25%', borderRadius: 4, backgroundColor: '#91B8F4'},
  scrollContent: {paddingBottom: 18},
  card: {minHeight: 500, marginHorizontal: 12, padding: 14, backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: '#E2E6EF'},
  cardTitle: {color: '#111735', fontSize: 15, fontWeight: '600', marginBottom: 14},
  uploadBox: {height: 180, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9D2E5', alignItems: 'center', justifyContent: 'center'},
  uploadIconCircle: {width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1F4FF', alignItems: 'center', justifyContent: 'center'},
  uploadIcon: {width: 34, height: 34},
  uploadHint: {marginTop: 9, color: '#6E7890', fontSize: 10, lineHeight: 15, textAlign: 'center'},
  uploadButton: {marginTop: 12, minWidth: 98, height: 31, borderRadius: 5, borderWidth: 1, borderColor: '#D5DCEB', alignItems: 'center', justifyContent: 'center'},
  uploadButtonText: {color: '#315FC5', fontSize: 10, fontWeight: '600'},
  galleryTitle: {marginTop: 15, marginBottom: 8, color: '#343B55', fontSize: 11, fontWeight: '600'},
  gallery: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  photoTile: {width: '31.5%', aspectRatio: 1.18, borderRadius: 7, backgroundColor: '#E8EBF2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  photoPreview: {width: '100%', height: '100%'},
  removeButton: {position: 'absolute', right: 3, top: 3, width: 17, height: 17, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  removeText: {color: '#61697D', fontSize: 15, lineHeight: 16},
  photoCheck: {position: 'absolute', left: 4, bottom: 4, width: 17, height: 17, borderRadius: 9, backgroundColor: '#22B86A', alignItems: 'center', justifyContent: 'center'},
  photoCheckText: {color: '#FFFFFF', fontSize: 11, fontWeight: '700'},
  addTile: {width: '31.5%', aspectRatio: 1.18, borderRadius: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFC8D9', alignItems: 'center', justifyContent: 'center'},
  addText: {color: '#4766A7', fontSize: 25},
  requirement: {color: '#778198', fontSize: 9, marginTop: 13},
  infoBox: {marginTop: 15, borderRadius: 6, padding: 10, backgroundColor: '#F2F5FC', flexDirection: 'row'},
  successBox: {backgroundColor: '#EDF9F1'},
  infoIcon: {color: '#5279CB', fontSize: 11, marginRight: 7},
  infoText: {flex: 1, color: '#69758E', fontSize: 9, lineHeight: 14},
  successText: {color: '#269B5C'},
  footer: {height: 72, paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E1E5EE', flexDirection: 'row', gap: 10},
  cancelButton: {flex: 1, height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#2963DA', alignItems: 'center', justifyContent: 'center'},
  cancelText: {color: '#17489E', fontSize: 12, fontWeight: '600'},
  saveButton: {flex: 1.25, height: 44, borderRadius: 6, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center'},
  saveDisabled: {backgroundColor: '#ECEEF3'},
  saveText: {color: '#FFFFFF', fontSize: 12, fontWeight: '600'},
  saveTextDisabled: {color: '#BFC4D0'},
  modalShade: {flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingBottom: 30},
  sheetHandle: {alignSelf: 'center', width: 46, height: 4, borderRadius: 2, backgroundColor: '#D8DCE5', marginTop: 9, marginBottom: 17},
  sheetTitle: {color: '#252C44', fontSize: 14, fontWeight: '600', marginBottom: 7},
  sourceRow: {height: 51, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF0F5'},
  sourceIconBox: {width: 31, height: 31, borderRadius: 7, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center'},
  sourceIcon: {width: 25, height: 25},
  sourceText: {color: '#28304A', fontSize: 12, marginLeft: 12},
});

export default FilesMediaScreen;
