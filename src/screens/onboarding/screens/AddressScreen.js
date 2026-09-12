import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {onboardingService} from '../../../services/apiService';

const emptyDetails = {door: '', building: '', floor: '', area: '', street: '', landmark: '', city: '', district: '', state: '', pincode: '', country: ''};

export const addressPayload = ({details, coordinate}) => ({
  shop_number: details.door.trim(), building_name: details.building.trim(),
  floor: details.floor.trim(), area_locality: details.area.trim(),
  street: details.street.trim(), landmark: details.landmark.trim(),
  city: details.city.trim(), state: details.state.trim(), pincode: details.pincode.trim(),
  latitude: coordinate.latitude, longitude: coordinate.longitude,
});

export const readAddress = (response, draft) => {
  if (!response || response.success === false) { throw new Error(response?.message || 'Unable to load address.'); }
  const record = response.data ?? response;
  if (typeof record !== 'object' || Array.isArray(record) || !('shop_number' in record)) {
    throw new Error('The server returned an invalid address response.');
  }
  const latitude = record.latitude == null || record.latitude === '' ? NaN : Number(record.latitude);
  const longitude = record.longitude == null || record.longitude === '' ? NaN : Number(record.longitude);
  const text = value => value == null ? '' : String(value);
  return {
    coordinate: Number.isFinite(latitude) && Number.isFinite(longitude) ? {latitude, longitude} : null,
    // These fields are not in the observed backend address projection. Keep the
    // user's draft without inventing request keys or discarding their input.
    placeId: draft?.placeId || '',
    details: {...emptyDetails, district: draft?.details?.district || '', country: draft?.details?.country || '', door: text(record.shop_number), building: text(record.building_name),
      floor: text(record.floor), area: text(record.area_locality), street: text(record.street),
      landmark: text(record.landmark), city: text(record.city), state: text(record.state), pincode: text(record.pincode)},
  };
};

const mapPinIcon = require('../../../assets/icons/address-location-pin.png');
const selectMapIcon = require('../../../assets/icons/address-select-map.png');
const currentLocationIcon = require('../../../assets/icons/address-current-location.png');
const mapPreview = require('../../../assets/icons/address-map-preview.png');

export const getAddressLocation = async () => {
  const locate = options => new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(({coords}) => {
      if (!Number.isFinite(coords?.latitude) || !Number.isFinite(coords?.longitude)) {
        reject({code: 2, message: 'No valid location was returned.'});
        return;
      }
      resolve({latitude: coords.latitude, longitude: coords.longitude});
    }, reject, options);
  });
  if (Platform.OS !== 'android') {
    return locate({enableHighAccuracy: true, timeout: 20000, maximumAge: 5000});
  }
  try {
    return await locate({enableHighAccuracy: true, timeout: 12000, maximumAge: 5000, showLocationDialog: true});
  } catch (error) {
    if (![2, 3, 4, 5].includes(error?.code)) { throw error; }
    // GPS can be unavailable indoors even when location and permissions are on.
    return locate({enableHighAccuracy: false, timeout: 15000, maximumAge: 5000,
      showLocationDialog: true, forceLocationManager: error.code === 4});
  }
};

const locationErrorMessage = error => {
  if (error?.code === 1) { return 'Please allow location access in app settings and try again.'; }
  if (error?.code === 3) { return 'The phone could not get a location fix in time. Try near a window or outdoors and retry.'; }
  if (error?.code === 5) { return 'Please enable location and Google Location Accuracy in device settings, then try again.'; }
  return 'The phone could not determine your location. Check your GPS signal or network connection and try again.';
};

function Field({label, value, onChangeText, required, placeholder}) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A1A7B8" style={styles.input} /></View>;
}

function AddressScreen({salonId, initialValues, onBack, onSave, onAddressVerified}) {
  const [coordinate, setCoordinate] = useState(initialValues?.coordinate || null);
  const [placeId, setPlaceId] = useState(initialValues?.placeId || '');
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [details, setDetails] = useState({...emptyDetails, ...initialValues?.details});
  const [busy, setBusy] = useState(true);
  const mounted = useRef(true);
  const pending = useRef(false);
  const verified = useRef(onAddressVerified);
  const initialDraft = useRef(initialValues);
  verified.current = onAddressVerified;
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const load = async () => {
      if (!active) { return; }
      setBusy(true);
      try {
        const values = readAddress(await onboardingService.getAddress(salonId), initialDraft.current);
        if (!active) { return; }
        setDetails(values.details);
        setCoordinate(values.coordinate);
        setPlaceId(values.placeId);
        verified.current?.(Boolean(values.coordinate && values.details.city && values.details.state && values.details.pincode));
      } catch (error) {
        if (!active) { return; }
        verified.current?.(false);
        Alert.alert('Unable to load address', error?.message || 'Please try again.', [{text: 'Cancel', style: 'cancel'}, {text: 'Retry', onPress: load}]);
      } finally {
        if (active) { setBusy(false); }
      }
    };
    load();
    return () => { active = false; mounted.current = false; };
  }, [salonId]);
  const setField = key => value => setDetails(current => ({...current, [key]: value}));

  const reverseGeocode = async point => {
    try {
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${point.latitude}&longitude=${point.longitude}&localityLanguage=en`);
      const data = await response.json();
      setDetails(current => ({...current, area: data.locality || current.area, city: data.city || data.locality || current.city, district: data.localityInfo?.administrative?.[2]?.name || current.district, state: data.principalSubdivision || current.state, pincode: data.postcode || current.pincode, country: data.countryName || current.country}));
    } catch {
      Alert.alert('Address lookup unavailable', 'Location selected. Please fill the address details manually.');
    }
  };

  const selectPoint = point => {
    setCoordinate(point);
    setPlaceId('');
    reverseGeocode(point);
  };

  const requestPermission = async () => {
    if (Platform.OS === 'ios') return (await Geolocation.requestAuthorization('whenInUse')) === 'granted';
    const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    if (await PermissionsAndroid.check(permission)) return true;
    return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
  };

  const useCurrentLocation = async () => {
    if (!(await requestPermission())) {
      Alert.alert('Location permission required', 'Please allow location access and try again.');
      return;
    }
    setCurrentLocationLoading(true);
    try {
      const point = await getDeviceLocation();
      selectPoint(point);
    } catch (error) {
      Alert.alert('Location unavailable', locationErrorMessage(error));
    } finally {
      setCurrentLocationLoading(false);
    }
  };

  const getDeviceLocation = getAddressLocation;

  const openMapAtCurrentLocation = async () => {
    if (!(await requestPermission())) {
      Alert.alert('Location permission required', 'Please allow location access and try again.');
      return;
    }
    setMapLoading(true);
    try {
      const point = await getDeviceLocation();
      selectPoint(point);
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
      await Linking.openURL(mapUrl);
    } catch (error) {
      if (coordinate) {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${coordinate.latitude},${coordinate.longitude}`;
        await Linking.openURL(mapUrl);
      } else {
        Alert.alert('Location unavailable', locationErrorMessage(error));
      }
    } finally {
      setMapLoading(false);
    }
  };

  const valid = Boolean(coordinate && details.city && details.state && details.pincode && details.country);
  const save = async () => {
    if (!valid || busy || currentLocationLoading || mapLoading || pending.current) { return; }
    pending.current = true;
    setBusy(true);
    verified.current?.(false);
    try {
      const response = await onboardingService.saveAddress(salonId, addressPayload({details, coordinate}));
      if (!response || response.success === false) { throw new Error(response?.message || 'The server did not confirm the address save.'); }
      const saved = readAddress(await onboardingService.getAddress(salonId), {details, placeId});
      if (!saved.coordinate || !saved.details.city || !saved.details.state || !saved.details.pincode) {
        throw new Error('The server did not return a complete saved address.');
      }
      if (mounted.current) { onSave(saved); }
    } catch (error) {
      if (mounted.current) { Alert.alert('Unable to save address', error?.message || 'Please try again.'); }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(false); }
    }
  };

  return <SafeAreaView style={styles.screen}>
    <StatusBar barStyle="light-content" backgroundColor="#07113D" />
    <View style={styles.header}><Pressable disabled={busy} onPress={onBack} style={styles.back}><Text style={styles.backText}>←</Text></Pressable><Text style={styles.title}>Add Address</Text></View>
    <View style={styles.progress}><Text style={styles.step}>Step 3 of 8</Text><View style={styles.track}><View style={styles.fill} /></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View pointerEvents={busy ? 'none' : 'auto'} style={styles.card}>
        <Text style={styles.cardTitle}>Tell us where the salon is located</Text><Text style={styles.subtitle}>Search and select the exact location on map.</Text>
        <View style={styles.mapWrap}><Image source={mapPreview} resizeMode="cover" style={styles.map} /></View>
        <View style={styles.mapButtons}><Pressable disabled={currentLocationLoading || mapLoading} onPress={useCurrentLocation} style={styles.mapButton}><Image source={currentLocationIcon} resizeMode="contain" style={styles.buttonIcon} /><Text style={styles.mapButtonText}>{currentLocationLoading ? 'Locating...' : 'Use current location'}</Text></Pressable><Pressable disabled={currentLocationLoading || mapLoading} onPress={openMapAtCurrentLocation} style={styles.mapButton}><Image source={selectMapIcon} resizeMode="contain" style={styles.buttonIcon} /><Text style={styles.mapButtonText}>{mapLoading ? 'Locating...' : 'Select on map'}</Text></Pressable></View>
        <Text style={styles.sectionTitle}>Address Details</Text>
        <View style={styles.row}><Field label="Shop / Door Number" required value={details.door} onChangeText={setField('door')} placeholder="Enter shop / door no." /><Field label="Building / Complex Name" value={details.building} onChangeText={setField('building')} placeholder="Enter building / complex" /></View>
        <View style={styles.row}><Field label="Floor" value={details.floor} onChangeText={setField('floor')} placeholder="Enter floor" /><Field label="Area / Locality" required value={details.area} onChangeText={setField('area')} placeholder="Enter area / locality" /></View>
        <Field label="Street / Road" required value={details.street} onChangeText={setField('street')} placeholder="Enter street / road" /><Field label="Landmark" value={details.landmark} onChangeText={setField('landmark')} placeholder="Enter landmark" />
        <View style={styles.row}><Field label="City" required value={details.city} onChangeText={setField('city')} placeholder="Enter city" /><Field label="District" value={details.district} onChangeText={setField('district')} placeholder="Enter district" /></View>
        <View style={styles.row}><Field label="State" required value={details.state} onChangeText={setField('state')} placeholder="Enter state" /><Field label="Pincode" required value={details.pincode} onChangeText={setField('pincode')} placeholder="Enter pincode" /></View>
        <Field label="Country" required value={details.country} onChangeText={setField('country')} placeholder="Enter country" />
        <View style={styles.autoBox}><View style={styles.iconTitleRow}><Image source={mapPinIcon} resizeMode="contain" style={styles.titleIcon} /><Text style={styles.iconTitle}>Location Coordinates (Auto-filled)</Text></View><View style={styles.row}><View style={styles.coord}><Text style={styles.smallLabel}>Latitude</Text><Text style={styles.coordValue}>{coordinate ? coordinate.latitude.toFixed(6) : 'Select location'}</Text></View><View style={styles.coord}><Text style={styles.smallLabel}>Longitude</Text><Text style={styles.coordValue}>{coordinate ? coordinate.longitude.toFixed(6) : 'Select location'}</Text></View></View></View>
        <View style={styles.placeBox}><View style={styles.iconTitleRow}><Image source={selectMapIcon} resizeMode="contain" style={styles.titleIcon} /><Text style={styles.iconTitle}>Google Maps Place ID (Auto-filled)</Text></View><Text style={styles.placeValue}>{placeId || 'Select a location on the map'}</Text></View>
      </View>
    </ScrollView>
    <View style={styles.footer}><Pressable disabled={busy} onPress={onBack} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!valid || busy || currentLocationLoading || mapLoading} onPress={save} style={[styles.save, (!valid || busy) && styles.disabled]}><Text style={[styles.saveText, (!valid || busy) && styles.disabledText]}>{busy ? 'Please wait...' : 'Save & Continue'}</Text></Pressable></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6F7FB'}, header: {height: 55, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14}, back: {width: 30, marginRight: 9}, backText: {color: '#FFF', fontSize: 19, lineHeight: 24}, title: {color: '#FFF', fontSize: 19, fontWeight: '600'},
  progress: {backgroundColor: '#07113D', paddingHorizontal: 20, paddingBottom: 15}, step: {color: '#FFF', fontSize: 13, marginBottom: 9}, track: {height: 6, borderRadius: 5, backgroundColor: '#60739B', overflow: 'hidden'}, fill: {height: '100%', width: '37.5%', borderRadius: 5, backgroundColor: '#91B8F4'}, content: {paddingBottom: 18},
  card: {marginHorizontal: 9, padding: 12, backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: '#E1E5EE'}, cardTitle: {color: '#121934', fontSize: 16, fontWeight: '600'}, subtitle: {fontSize: 11, color: '#7C8499', marginTop: 5, marginBottom: 11}, mapWrap: {height: 190, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3EFE4'}, map: {width: '100%', height: '100%'}, mapSoftOverlay: {position: 'absolute', inset: 0, backgroundColor: 'rgba(255,248,232,0.18)'}, mapCredit: {position: 'absolute', right: 4, bottom: 3, color: '#4F5870', backgroundColor: 'rgba(255,255,255,0.82)', fontSize: 8, paddingHorizontal: 3}, pinIcon: {width: 34, height: 34}, mapButtons: {flexDirection: 'row', gap: 7, marginTop: 8}, mapButton: {flex: 1, height: 36, borderWidth: 1, borderColor: '#4C76E8', borderRadius: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}, buttonIcon: {width: 15, height: 15, marginRight: 5}, mapButtonText: {color: '#2E5CC8', fontSize: 11, fontWeight: '600'},
  autoBox: {marginTop: 12, padding: 9, borderRadius: 6, backgroundColor: '#F7F9FD'}, autoTitle: {color: '#354264', fontSize: 11, fontWeight: '600', marginBottom: 7}, iconTitleRow: {height: 22, flexDirection: 'row', alignItems: 'center', marginBottom: 5}, titleIcon: {width: 17, height: 17, marginRight: 5}, iconTitle: {color: '#354264', fontSize: 11, fontWeight: '600'}, row: {flexDirection: 'row', gap: 8}, coord: {flex: 1}, smallLabel: {color: '#747D94', fontSize: 10}, coordValue: {height: 32, marginTop: 4, borderWidth: 1, borderColor: '#DEE3EC', borderRadius: 5, paddingHorizontal: 8, paddingTop: 7, color: '#26304C', fontSize: 11}, sectionTitle: {fontSize: 14, fontWeight: '600', color: '#202842', marginTop: 15, marginBottom: 8},
  field: {flex: 1, marginBottom: 10}, label: {color: '#343B55', fontSize: 10, fontWeight: '600', marginBottom: 5}, required: {color: '#E94251'}, input: {height: 37, borderWidth: 1, borderColor: '#DDE2EC', borderRadius: 5, color: '#1F2948', fontSize: 11, paddingHorizontal: 8, paddingVertical: 0}, placeBox: {padding: 10, marginTop: 3, borderWidth: 1, borderColor: '#DEE3EC', borderRadius: 6}, placeValue: {color: '#253052', fontSize: 11},
  footer: {height: 70, padding: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E5EC', flexDirection: 'row', gap: 10}, cancel: {flex: 1, height: 44, borderWidth: 1, borderColor: '#3168DE', borderRadius: 6, alignItems: 'center', justifyContent: 'center'}, cancelText: {color: '#2052B1', fontSize: 13, fontWeight: '600'}, save: {flex: 1.25, height: 44, borderRadius: 6, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center'}, saveText: {color: '#FFF', fontSize: 13, fontWeight: '600'}, disabled: {backgroundColor: '#ECEEF3'}, disabledText: {color: '#BDC2CE'}, fullMapScreen: {flex: 1, backgroundColor: '#FFF'}, mapHeader: {height: 58, backgroundColor: '#07113D', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center'}, fullMap: {flex: 1}, mapConfirmWrap: {padding: 14, paddingBottom: 18, backgroundColor: '#FFF'}, mapHelp: {color: '#69738B', fontSize: 12, marginBottom: 10, textAlign: 'center'},
});

export default AddressScreen;
