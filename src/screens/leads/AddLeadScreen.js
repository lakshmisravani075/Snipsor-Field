import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import LeadDetailsScreen from './LeadDetailsScreen.js';
import {leadService} from '../../services/apiService.js';

const salonIcon = require('../../assets/icons/add-salon-outline.png');
const contactIcon = require('../../assets/icons/add-contact-outline.png');
const phoneIcon = require('../../assets/icons/add-phone-outline.png');
const whatsappIcon = require('../../assets/icons/add-whatsapp-outline.png');
const locationIcon = require('../../assets/icons/detail-location.png');
const locationMapPreview = require('../../assets/images/relative/location-map-preview.png');
const followUpStatusIcon = require('../../assets/icons/status-follow-up.png');
const leadAddedSuccessIcon = require('../../assets/icons/lead-added-success.png');

const MONTH_NUMBERS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dateFromDisplayValue = value => {
  const match = String(value || '').trim().match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  const monthIndex = match ? MONTHS.findIndex(month => month.toLowerCase() === match[2].toLowerCase()) : -1;
  if (!match || monthIndex < 0) {
    return new Date();
  }
  const date = new Date(Number(match[3]), monthIndex, Number(match[1]));
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const findLocationInfoValue = (items, typePattern) => {
  if (!Array.isArray(items)) {
    return '';
  }
  const match = items.find(item => typePattern.test(`${item?.description || ''} ${item?.type || ''}`));
  return match?.name || match?.value || '';
};

const buildCurrentAddress = location => {
  const localityInfo = location?.localityInfo || {};
  const city = location.city
    || findLocationInfoValue(localityInfo.administrative, /\bcity\b|municipal|metropolitan/i);
  const postcode = location.postcode
    || location.postalCode
    || location.zipCode
    || findLocationInfoValue(localityInfo.informative, /post\s*code|postal|zip/i)
    || findLocationInfoValue(localityInfo.administrative, /post\s*code|postal|zip/i);
  const uniqueParts = [];
  [location.locality, city, location.principalSubdivision, postcode, location.countryName]
    .filter(Boolean)
    .forEach(part => {
      const value = String(part).trim();
      if (value && !uniqueParts.some(existing => existing.toLowerCase() === value.toLowerCase())) {
        uniqueParts.push(value);
      }
    });
  return uniqueParts.join(', ');
};

const getLeadId = lead => lead?.id || lead?.lead_id || lead?.leadId || lead?.uuid || null;

const extractLeadList = response => {
  const candidates = [response, response?.data, response?.leads, response?.data?.leads, response?.items, response?.data?.items, response?.rows, response?.data?.rows];
  return candidates.find(Array.isArray) || [];
};

const toIsoDate = value => {
  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmedValue;
  }
  const displayMatch = trimmedValue.match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i);
  if (!displayMatch) {
    return null;
  }
  const [, day, monthName, year] = displayMatch;
  const month = MONTH_NUMBERS[monthName.slice(0, 3).toLowerCase()];
  if (!month) {
    return null;
  }
  const paddedDay = day.padStart(2, '0');
  const candidate = `${year}-${month}-${paddedDay}`;
  const parsedDate = new Date(`${candidate}T00:00:00Z`);
  return parsedDate.getUTCFullYear() === Number(year)
    && parsedDate.getUTCMonth() + 1 === Number(month)
    && parsedDate.getUTCDate() === Number(day)
    ? candidate
    : null;
};

const toApiTime = value => {
  const trimmedValue = value.trim();
  const twelveHourMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHourMatch) {
    const [, rawHour, minute, period] = twelveHourMatch;
    const hour = Number(rawHour);
    if (hour < 1 || hour > 12 || Number(minute) > 59) {
      return null;
    }
    const hour24 = (hour % 12) + (period.toUpperCase() === 'PM' ? 12 : 0);
    return `${String(hour24).padStart(2, '0')}:${minute}`;
  }
  const twentyFourHourMatch = trimmedValue.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return twentyFourHourMatch ? trimmedValue : null;
};

function FieldLabel({children, required}) {
  return <Text style={styles.label}>{children}{required && <Text style={styles.required}> *</Text>}</Text>;
}

function InputField({icon, iconTint, placeholder, value, onChangeText, keyboardType}) {
  return (
    <View style={styles.inputBox}>
      <View style={styles.inputIconWrap}><Image source={icon} resizeMode="contain" style={[styles.inputIconImage, iconTint && {tintColor: iconTint}]} /></View>
      <TextInput keyboardType={keyboardType} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#69718F" style={styles.input} value={value} />
    </View>
  );
}

function LeadAddedSuccess({lead, onAddAnother, onBack, onViewDetails}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const confettiMotion = useRef(new Animated.Value(0)).current;
  const statusBackground = lead.status === 'Interested' ? '#E1F8E9' : lead.status === 'Follow-up' ? '#FFF0EA' : '#FFECEF';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, {toValue: 1, duration: 420, useNativeDriver: true}),
      Animated.sequence([
        Animated.delay(130),
        Animated.spring(checkScale, {toValue: 1, friction: 5, tension: 75, useNativeDriver: true}),
      ]),
    ]).start();
    const confettiAnimation = Animated.loop(Animated.sequence([
      Animated.timing(confettiMotion, {toValue: 1, duration: 900, useNativeDriver: true}),
      Animated.timing(confettiMotion, {toValue: 0, duration: 900, useNativeDriver: true}),
    ]));
    confettiAnimation.start();
    return () => confettiAnimation.stop();
  }, [checkScale, confettiMotion, entrance]);

  const confetti = [
    ['#FFB020', 15, 12], ['#FF3F67', 29, 7], ['#20B967', 43, 14], ['#5938F4', 58, 9],
    ['#0A9CE8', 73, 15], ['#A63CF0', 84, 8], ['#FF7038', 92, 16], ['#26B9B1', 7, 24],
  ];

  return (
    <SafeAreaView style={styles.successScreen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={onBack} style={styles.successBackButton}>
        <Ionicons name="arrow-back" size={23} color="#10183C" />
      </Pressable>
      <Animated.View style={[styles.successCard, {opacity: entrance, transform: [{translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [28, 0]})}]}]}>
        <Animated.View style={[styles.confettiArea, {transform: [{translateY: confettiMotion.interpolate({inputRange: [0, 1], outputRange: [-3, 5]})}]}]}>
          {confetti.map(([color, left, top], index) => <View key={`${color}-${index}`} style={[styles.confettiDot, {backgroundColor: color, left: `${left}%`, top}]} />)}
          <Animated.Image source={leadAddedSuccessIcon} resizeMode="contain" style={[styles.successIconImage, {transform: [{scale: checkScale}]}]} />
        </Animated.View>
        <View style={styles.savedBadge}><View style={styles.savedBadgeDot} /><Text style={styles.savedBadgeText}>LEAD SAVED</Text></View>
        <Text style={styles.successTitle}>Lead Added{`\n`}Successfully!</Text>
        <Text style={styles.successSubtitle}>{lead.name} has been added{`\n`}as a new lead.</Text>
        <View style={styles.savedLeadCard}>
          <View style={styles.savedLeadIconWrap}><Image source={salonIcon} resizeMode="contain" style={styles.savedLeadIcon} /></View>
          <View style={styles.savedLeadText}><Text style={styles.savedLeadName}>{lead.name}</Text><Text style={styles.savedLeadLocation}>{lead.location || 'Location not provided'}</Text><Text style={styles.savedLeadAdded}>Added just now</Text></View>
          <View style={[styles.savedLeadStatus, {backgroundColor: statusBackground}]}><Text style={[styles.savedLeadStatusText, {color: lead.color}]}>{lead.status}</Text></View>
        </View>
        <Pressable onPress={onViewDetails} style={({pressed}) => [styles.viewDetailsButton, pressed && styles.savePressed]}><Text style={styles.viewDetailsText}>View Lead Details</Text></Pressable>
        <Pressable onPress={onAddAnother} style={({pressed}) => [styles.addAnotherButton, pressed && styles.savePressed]}><Text style={styles.addAnotherText}>Add Another Lead</Text></Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function AddLeadScreen({onBack, onSessionExpired}) {
  const [salonName, setSalonName] = useState('');
  const [salonType, setSalonType] = useState('');
  const [isSalonTypeOpen, setIsSalonTypeOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [leadStatus, setLeadStatus] = useState('Interested');
  const [followUpDate, setFollowUpDate] = useState('25 May 2026');
  const [followUpTime, setFollowUpTime] = useState('04:00 PM');
  const [followUpNote, setFollowUpNote] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => dateFromDisplayValue('25 May 2026'));
  const [savedLeadData, setSavedLeadData] = useState(null);
  const [isViewingSavedLead, setIsViewingSavedLead] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const onlyNumbers = setter => value => setter(value.replace(/\D/g, '').slice(0, 10));

  const openCalendar = () => {
    const selectedDate = dateFromDisplayValue(followUpDate);
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setIsCalendarOpen(true);
  };

  const changeCalendarMonth = offset => {
    setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const changeCalendarYear = offset => {
    setCalendarMonth(current => new Date(current.getFullYear() + offset, current.getMonth(), 1));
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      return (await Geolocation.requestAuthorization('whenInUse')) === 'granted';
    }
    const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    if (await PermissionsAndroid.check(permission)) {
      return true;
    }
    const result = await PermissionsAndroid.request(permission, {
      title: 'Allow location access',
      message: 'Snipsor Field uses your location to select the salon address.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const useCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert(
        'Location permission required',
        'Enable location permission for Snipsor Field, then tap Use Current Location again.',
        [
          {text: 'Try Again', onPress: useCurrentLocation},
          {text: 'Open Settings', onPress: () => Linking.openSettings()},
        ],
      );
      return;
    }

    setIsLocating(true);
    Geolocation.getCurrentPosition(
      async ({coords}) => {
        setLocationAccuracy(Math.round(coords.accuracy));
        setCoordinates({latitude: coords.latitude, longitude: coords.longitude});
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
          );
          if (!response.ok) {
            throw new Error('Address lookup failed');
          }
          const location = await response.json();
          const currentAddress = buildCurrentAddress(location);
          if (!currentAddress) {
            throw new Error('Address unavailable');
          }
          setAddress(currentAddress);
        } catch {
          setAddress('');
          Alert.alert('Address unavailable', 'Current location was selected, but its address could not be found. Please enter the address manually.');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        Alert.alert('Location unavailable', 'Unable to get your current location. Please try again.');
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const saveLead = async () => {
    if (isSaving) {
      return;
    }
    if (!salonName.trim() || !salonType || !contactName.trim() || phone.length !== 10 || !address.trim()) {
      Alert.alert('Required details missing', 'Enter the salon name, salon type, contact person, valid phone number, and complete address.');
      return;
    }
    if (whatsapp && whatsapp.length !== 10) {
      Alert.alert('Invalid WhatsApp number', 'Enter a valid 10-digit WhatsApp number or leave it empty.');
      return;
    }
    if (leadStatus === 'Follow-up' && (!followUpDate.trim() || !followUpTime.trim())) {
      Alert.alert('Follow-up details missing', 'Enter the follow-up date and time.');
      return;
    }

    const apiFollowUpDate = leadStatus === 'Follow-up' ? toIsoDate(followUpDate) : null;
    const apiFollowUpTime = leadStatus === 'Follow-up' ? toApiTime(followUpTime) : null;
    if (leadStatus === 'Follow-up' && (!apiFollowUpDate || !apiFollowUpTime)) {
      Alert.alert('Invalid follow-up details', 'Enter the date as DD MMM YYYY and time as HH:MM AM/PM.');
      return;
    }

    const payload = {
      salon_name: salonName.trim(),
      salon_type: salonType,
      contact_person: contactName.trim(),
      phone_number: `+91${phone}`,
      whatsapp_number: whatsapp ? `+91${whatsapp}` : null,
      address: address.trim(),
      landmark: landmark.trim() || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      location_accuracy: locationAccuracy,
      status: leadStatus.toUpperCase().replace(/[ -]+/g, '_'),
      follow_up_date: apiFollowUpDate,
      follow_up_time: apiFollowUpTime,
      follow_up_note: leadStatus === 'Follow-up' ? followUpNote.trim() || null : null,
    };

    try {
      setIsSaving(true);
      const response = await leadService.createLead(payload);
      const createdLeadResponse = response?.data?.lead || response?.data || response?.lead || response;
      let createdLead = createdLeadResponse && typeof createdLeadResponse === 'object' ? createdLeadResponse : {};
      let createdLeadId = getLeadId(createdLead);
      if (!createdLeadId) {
        try {
          const leadsResponse = await leadService.getLeads();
          const submittedPhone = payload.phone_number.replace(/\D/g, '').slice(-10);
          const matchingLead = extractLeadList(leadsResponse).find(item => {
            const itemPhone = String(item?.phone_number || item?.phoneNumber || '').replace(/\D/g, '').slice(-10);
            const itemSalonName = String(item?.salon_name || item?.salonName || '').trim().toLowerCase();
            return itemPhone === submittedPhone && itemSalonName === payload.salon_name.toLowerCase();
          });
          if (matchingLead) {
            createdLead = {...createdLead, ...matchingLead};
            createdLeadId = getLeadId(matchingLead);
          }
        } catch {
          // The create response data is still sufficient for the success screen.
        }
      }
      setSavedLeadData({
        ...createdLead,
        id: createdLeadId,
        name: createdLead?.salon_name || createdLead?.salonName || payload.salon_name,
        salonType: createdLead?.salon_type || createdLead?.salonType || payload.salon_type,
        location: createdLead?.address || payload.address,
        person: createdLead?.contact_person || createdLead?.contactPerson || payload.contact_person,
        phone: createdLead?.phone_number || createdLead?.phoneNumber || payload.phone_number,
        whatsapp: createdLead?.whatsapp_number || createdLead?.whatsappNumber || payload.whatsapp_number,
        pincode: createdLead?.pincode || createdLead?.pin_code || createdLead?.postcode || createdLead?.postal_code || createdLead?.postalCode || payload.address.match(/\b\d{6}\b/)?.[0] || '',
        notes: createdLead?.follow_up_note || createdLead?.followUpNote || createdLead?.follow_up_notes || createdLead?.note || createdLead?.notes || payload.follow_up_note || '',
        followup: createdLead?.follow_up_date || createdLead?.followUpDate || payload.follow_up_date,
        status: leadStatus,
        color: leadStatus === 'Interested' ? '#20B967' : leadStatus === 'Follow-up' ? '#FF5B3E' : '#FF3F4F',
      });
    } catch (error) {
      if (error?.status === 401) {
        Alert.alert(
          'Session expired',
          'Please log in again to continue.',
          [{text: 'OK', onPress: onSessionExpired}],
        );
        return;
      }
      Alert.alert('Unable to save lead', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addAnotherLead = () => {
    setSalonName(''); setSalonType(''); setIsSalonTypeOpen(false); setContactName(''); setPhone(''); setWhatsapp(''); setAddress(''); setLandmark('');
    setLocationAccuracy(null); setCoordinates(null); setLeadStatus('Interested'); setFollowUpDate('25 May 2026'); setFollowUpTime('04:00 PM'); setFollowUpNote('');
    setSavedLeadData(null);
  };

  if (isViewingSavedLead && savedLeadData) {
    return <LeadDetailsScreen lead={savedLeadData} onBack={() => setIsViewingSavedLead(false)} onSessionExpired={onSessionExpired} />;
  }

  if (savedLeadData) {
    return <LeadAddedSuccess lead={savedLeadData} onAddAnother={addAnotherLead} onBack={onBack} onViewDetails={() => setIsViewingSavedLead(true)} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" hitSlop={12} onPress={onBack} style={styles.backButton}>
            <View style={styles.backArrow}><View style={styles.arrowLine} /><View style={styles.arrowTop} /><View style={styles.arrowBottom} /></View>
          </Pressable>
          <Text style={styles.title}>Add Lead</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
          <View style={styles.fieldsCard}>
            <FieldLabel required>Salon Name</FieldLabel>
            <InputField icon={salonIcon} onChangeText={setSalonName} placeholder="Enter salon name" value={salonName} />

            <FieldLabel required>Salon Type</FieldLabel>
            <Pressable onPress={() => setIsSalonTypeOpen(value => !value)} style={styles.salonTypeField}>
              <Text style={[styles.salonTypeText, !salonType && styles.salonTypePlaceholder]}>{salonType || 'Select salon type'}</Text>
              <View style={styles.down}><View style={styles.downLeft} /><View style={styles.downRight} /></View>
            </Pressable>
            {isSalonTypeOpen && (
              <View style={styles.salonTypeOptions}>
                {['Male', 'Female', 'Unisex'].map(option => (
                  <Pressable key={option} onPress={() => {setSalonType(option); setIsSalonTypeOpen(false);}} style={styles.salonTypeOption}>
                    <Text style={[styles.salonTypeOptionText, salonType === option && styles.salonTypeOptionSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <FieldLabel required>Contact Person</FieldLabel>
            <InputField icon={contactIcon} iconTint="#1264E8" onChangeText={setContactName} placeholder="Enter contact person name" value={contactName} />

            <FieldLabel required>Phone Number</FieldLabel>
            <View style={styles.phoneRow}>
              <Pressable style={styles.countryCode}><Text style={styles.countryText}>+91</Text><View style={styles.down}><View style={styles.downLeft} /><View style={styles.downRight} /></View></Pressable>
              <View style={[styles.inputBox, styles.phoneInput]}><View style={styles.inputIconWrap}><Image source={phoneIcon} resizeMode="contain" style={styles.inputIconImage} /></View><TextInput keyboardType="number-pad" maxLength={10} onChangeText={onlyNumbers(setPhone)} placeholder="Enter phone number" placeholderTextColor="#69718F" style={styles.input} value={phone} /></View>
            </View>

            <FieldLabel>WhatsApp Number</FieldLabel>
            <View style={styles.phoneRow}>
              <Pressable style={styles.countryCode}><Text style={styles.countryText}>+91</Text><View style={styles.down}><View style={styles.downLeft} /><View style={styles.downRight} /></View></Pressable>
              <View style={[styles.inputBox, styles.phoneInput]}><View style={styles.inputIconWrap}><Image source={whatsappIcon} resizeMode="contain" style={styles.whatsappIconImage} /></View><TextInput keyboardType="number-pad" maxLength={10} onChangeText={onlyNumbers(setWhatsapp)} placeholder="Enter WhatsApp number" placeholderTextColor="#69718F" style={styles.input} value={whatsapp} /></View>
            </View>
            <Text style={styles.helper}>We will contact on this number</Text>
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationMap}>
              <Image source={locationMapPreview} resizeMode="cover" style={styles.locationMapImage} />
            </View>
            <Pressable disabled={isLocating} onPress={useCurrentLocation} style={({pressed}) => [styles.currentLocationButton, pressed && styles.savePressed]}>
              <Image source={locationIcon} resizeMode="contain" style={styles.currentLocationIcon} />
              <Text style={styles.currentLocationText}>{isLocating ? 'Selecting Location...' : 'Use Current Location'}</Text>
            </Pressable>
            <View style={styles.accuracyRow}>
              <Text style={styles.locationLabel}>Location Accuracy</Text>
              {locationAccuracy !== null && <Text style={styles.accuracyText}>{locationAccuracy} meters</Text>}
            </View>
            <FieldLabel required>Complete Address</FieldLabel>
            <TextInput onChangeText={setAddress} placeholder="Enter complete address" placeholderTextColor="#69718F" style={styles.locationInput} value={address} />
            <FieldLabel>Nearby Landmark (Optional)</FieldLabel>
            <TextInput onChangeText={setLandmark} placeholder="Enter nearby landmark" placeholderTextColor="#69718F" style={styles.locationInput} value={landmark} />
            <View style={styles.locationHint}>
              <Image source={locationIcon} resizeMode="contain" style={styles.hintIcon} />
              <Text style={styles.hintText}>Use current location to select the exact salon location.</Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusHeading}>Status</Text>
            {[
              {title: 'Interested', subtitle: 'Salon is interested in joining Snipsor', iconName: 'thumbs-up-outline', iconColor: '#00BF4D'},
              {title: 'Not Interested', subtitle: 'Salon is not interested right now', iconName: 'thumbs-down-outline', iconColor: '#FF0036'},
              {title: 'Follow-up', subtitle: 'We will follow up later', icon: followUpStatusIcon},
            ].map(option => {
              const selected = leadStatus === option.title;
              return (
                <Pressable key={option.title} onPress={() => setLeadStatus(option.title)} style={[styles.statusOption, selected && styles.statusOptionSelected]}>
                  <View style={styles.statusIconWrap}>{option.iconName ? <Ionicons name={option.iconName} size={25} color={option.iconColor} style={styles.statusIconImage} /> : <Image source={option.icon} resizeMode="contain" style={styles.statusIconImage} />}</View>
                  <View style={styles.statusTextWrap}><Text style={styles.statusOptionTitle}>{option.title}</Text><Text style={styles.statusOptionSubtitle}>{option.subtitle}</Text></View>
                  <View style={[styles.radioOuter, !selected && styles.radioUnselected]}>{selected && <View style={styles.radioInner} />}</View>
                </Pressable>
              );
            })}
          </View>

          {leadStatus === 'Follow-up' && (
            <View style={styles.followUpCard}>
              <Text style={styles.followUpHeading}>Follow-up Details</Text>
              <FieldLabel required>Follow-up Date</FieldLabel>
              <Pressable accessibilityRole="button" accessibilityLabel="Select follow-up date" onPress={openCalendar} style={styles.followUpInputBox}>
                <Text style={styles.followUpDateText}>{followUpDate}</Text>
                <Ionicons name="calendar-outline" size={26} color="#344599" style={styles.followUpCalendarFieldIcon} />
              </Pressable>
              <FieldLabel required>Follow-up Time</FieldLabel>
              <View style={styles.followUpInputBox}>
                <TextInput onChangeText={setFollowUpTime} style={styles.followUpInput} value={followUpTime} />
                <Image source={followUpStatusIcon} resizeMode="contain" style={styles.followUpTimeFieldIcon} />
              </View>
              <FieldLabel>Note (Optional)</FieldLabel>
              <View style={styles.followUpNotesBox}>
                <TextInput multiline maxLength={300} onChangeText={setFollowUpNote} placeholder="Enter follow-up notes" placeholderTextColor="#69718F" style={styles.followUpNotesInput} textAlignVertical="top" value={followUpNote} />
                <Text style={styles.followUpCounter}>{followUpNote.length}/300</Text>
              </View>
            </View>
          )}

          <View style={styles.flexSpace} />
          <Pressable disabled={isSaving} onPress={saveLead} style={({pressed}) => [styles.saveButton, isSaving && styles.saveButtonDisabled, pressed && styles.savePressed]}><Text style={styles.saveText}>{isSaving ? 'Saving Lead...' : 'Save Lead'}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent animationType="fade" visible={isCalendarOpen} onRequestClose={() => setIsCalendarOpen(false)}>
        <Pressable onPress={() => setIsCalendarOpen(false)} style={styles.calendarBackdrop}>
          <Pressable onPress={() => {}} style={styles.calendarCard}>
            <View style={styles.calendarYearRow}>
              <Pressable accessibilityLabel="Previous year" onPress={() => changeCalendarYear(-1)} style={styles.calendarNavButton}><Text style={styles.calendarNavText}>‹‹</Text></Pressable>
              <Text style={styles.calendarYear}>{calendarMonth.getFullYear()}</Text>
              <Pressable accessibilityLabel="Next year" onPress={() => changeCalendarYear(1)} style={styles.calendarNavButton}><Text style={styles.calendarNavText}>››</Text></Pressable>
            </View>
            <View style={styles.calendarMonthRow}>
              <Pressable accessibilityLabel="Previous month" onPress={() => changeCalendarMonth(-1)} style={styles.calendarNavButton}><Text style={styles.calendarNavText}>‹</Text></Pressable>
              <Text style={styles.calendarMonth}>{MONTHS[calendarMonth.getMonth()]}</Text>
              <Pressable accessibilityLabel="Next month" onPress={() => changeCalendarMonth(1)} style={styles.calendarNavButton}><Text style={styles.calendarNavText}>›</Text></Pressable>
            </View>
            <View style={styles.calendarWeekRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={styles.calendarWeekDay}>{day}</Text>)}
            </View>
            <View style={styles.calendarDays}>
              {Array.from({length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay()}, (_, index) => <View key={`empty-${index}`} style={styles.calendarDay} />)}
              {Array.from({length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()}, (_, index) => index + 1).map(day => {
                const value = `${day} ${MONTHS[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
                const selected = followUpDate === value;
                return <Pressable key={day} onPress={() => { setFollowUpDate(value); setIsCalendarOpen(false); }} style={[styles.calendarDay, selected && styles.calendarDaySelected]}><Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected]}>{day}</Text></Pressable>;
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  radioUnselected: {borderColor: '#929AB5'},
  successScreen: {flex: 1, backgroundColor: '#F8F7FF', paddingHorizontal: 24, paddingVertical: 20, justifyContent: 'center'}, successBackButton: {position: 'absolute', top: 20, left: 24, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', zIndex: 1}, successCard: {width: '100%', paddingHorizontal: 6, paddingVertical: 8}, confettiArea: {height: 92, position: 'relative', alignItems: 'center', justifyContent: 'center'}, confettiDot: {position: 'absolute', width: 5, height: 5, transform: [{rotate: '45deg'}]}, successIconImage: {width: 68, height: 68}, savedBadge: {height: 24, borderRadius: 12, backgroundColor: '#E7FAF1', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 9}, savedBadgeDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#18BE77', marginRight: 6}, savedBadgeText: {color: '#16945F', fontSize: 9, fontWeight: '600', letterSpacing: 0.7}, successTitle: {color: '#10183C', fontSize: 23, lineHeight: 28, fontWeight: '600', textAlign: 'center'}, successSubtitle: {color: '#59627E', fontSize: 12, lineHeight: 18, fontWeight: '400', textAlign: 'center', marginTop: 8}, savedLeadCard: {minHeight: 84, marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9F2', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 7, elevation: 3}, savedLeadIconWrap: {width: 42, height: 42, borderRadius: 10, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'}, savedLeadIcon: {width: 29, height: 29}, savedLeadText: {flex: 1, marginLeft: 10}, savedLeadName: {color: '#11183A', fontSize: 13, fontWeight: '500'}, savedLeadLocation: {color: '#626986', fontSize: 10.5, marginTop: 3}, savedLeadAdded: {color: '#626986', fontSize: 9.5, marginTop: 3}, savedLeadStatus: {borderRadius: 6, backgroundColor: '#E1F8E9', paddingHorizontal: 8, paddingVertical: 5}, savedLeadStatusText: {color: '#20A65E', fontSize: 10}, viewDetailsButton: {height: 48, borderRadius: 9, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center', marginTop: 28, shadowColor: '#07113D', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.16, shadowRadius: 6, elevation: 3}, viewDetailsText: {color: '#FFFFFF', fontSize: 14, fontWeight: '500'}, addAnotherButton: {height: 48, borderRadius: 9, borderWidth: 1.3, borderColor: '#6E67F5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 10}, addAnotherText: {color: '#30227D', fontSize: 14, fontWeight: '500'},
  screen: {flex: 1, backgroundColor: '#F3F4F7', justifyContent: 'flex-start'},
  header: {height: 62, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#E1E5EE'},
  backButton: {width: 28, height: 32, justifyContent: 'center'}, backArrow: {width: 18, height: 16, justifyContent: 'center'}, arrowLine: {width: 17, height: 2, borderRadius: 1, backgroundColor: '#10183C'}, arrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#10183C', transform: [{rotate: '-45deg'}]}, arrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#10183C', transform: [{rotate: '45deg'}]},
  title: {color: '#10183C', fontSize: 16, fontWeight: '400', marginLeft: 2},
  form: {flexGrow: 1, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10},
  fieldsCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E1E5EE', paddingHorizontal: 10, paddingTop: 2, paddingBottom: 12},
  locationCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E1E5EE', marginTop: 12, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12},
  locationMap: {height: 145, borderRadius: 10, overflow: 'hidden', backgroundColor: '#EDF1F5'}, locationMapImage: {width: '100%', height: '100%'},
  currentLocationButton: {height: 36, marginHorizontal: 62, marginTop: -18, borderRadius: 7, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#243052', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.14, shadowRadius: 7, elevation: 4}, currentLocationIcon: {width: 15, height: 15, marginRight: 6, tintColor: '#4D32F4'}, currentLocationText: {color: '#4D32F4', fontSize: 11, fontWeight: '400'},
  accuracyRow: {height: 34, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, locationLabel: {color: '#505A78', fontSize: 10}, accuracyText: {color: '#219653', fontSize: 10, backgroundColor: '#E5F7EA', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4},
  locationInput: {height: 44, borderWidth: 1.3, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FFFFFF', color: '#11183A', fontFamily: Platform.select({android: 'sans-serif', ios: 'System'}), fontSize: 11.5, fontWeight: '400', paddingHorizontal: 12, paddingVertical: 0},
  locationHint: {minHeight: 48, marginTop: 14, borderRadius: 9, backgroundColor: '#F2F0FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11}, hintIcon: {width: 19, height: 19, marginRight: 8, tintColor: '#4D32F4'}, hintText: {flex: 1, color: '#4F5680', fontSize: 10, lineHeight: 15},
  statusCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E1E5EE', marginTop: 12, paddingHorizontal: 10, paddingTop: 13, paddingBottom: 11, gap: 9}, statusHeading: {color: '#172044', fontSize: 14, fontWeight: '400', marginBottom: 1}, statusOption: {minHeight: 66, borderRadius: 9, borderWidth: 1, borderColor: '#E1E5EE', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, statusOptionSelected: {borderWidth: 1.5, borderColor: '#8073FF', backgroundColor: '#FAF9FF'}, statusIconWrap: {width: 36, alignItems: 'flex-start', justifyContent: 'center'}, statusIconImage: {width: 25, height: 25}, statusTextWrap: {flex: 1}, statusOptionTitle: {color: '#172044', fontSize: 12.5, fontWeight: '500'}, statusOptionSubtitle: {color: '#59627E', fontSize: 10.5, fontWeight: '400', marginTop: 4}, radioOuter: {width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#5B42F5', alignItems: 'center', justifyContent: 'center', marginLeft: 8}, radioInner: {width: 11, height: 11, borderRadius: 6, backgroundColor: '#5B42F5'},
  followUpCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E1E5EE', marginTop: 12, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 13}, followUpHeading: {color: '#4D32F4', fontSize: 14, fontWeight: '500', marginBottom: 2}, followUpInputBox: {height: 44, borderWidth: 1, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center'}, followUpInput: {flex: 1, height: '100%', color: '#172044', fontSize: 12, paddingHorizontal: 12, paddingVertical: 0}, followUpDateText: {flex: 1, color: '#172044', fontSize: 12, paddingHorizontal: 12}, followUpCalendarFieldIcon: {width: 26, height: 26, marginRight: 9, tintColor: '#344599'}, followUpTimeFieldIcon: {width: 18, height: 18, marginRight: 13}, followUpNotesBox: {height: 105, borderWidth: 1, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FFFFFF', position: 'relative'}, followUpNotesInput: {flex: 1, color: '#172044', fontSize: 12, lineHeight: 18, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24}, followUpCounter: {position: 'absolute', right: 10, bottom: 7, color: '#69718F', fontSize: 10},
  calendarBackdrop: {flex: 1, backgroundColor: 'rgba(7,17,61,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22}, calendarCard: {width: '100%', borderRadius: 16, backgroundColor: '#FFFFFF', padding: 18}, calendarYearRow: {height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, calendarMonthRow: {height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}, calendarNavButton: {width: 44, height: 38, alignItems: 'center', justifyContent: 'center'}, calendarNavText: {color: '#452EE5', fontSize: 26, lineHeight: 30}, calendarYear: {color: '#172044', fontSize: 16, fontWeight: '600'}, calendarMonth: {color: '#452EE5', fontSize: 15, fontWeight: '600'}, calendarWeekRow: {flexDirection: 'row', marginBottom: 5}, calendarWeekDay: {width: '14.285%', textAlign: 'center', color: '#69718F', fontSize: 10}, calendarDays: {flexDirection: 'row', flexWrap: 'wrap'}, calendarDay: {width: '14.285%', height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'}, calendarDaySelected: {backgroundColor: '#4D32F4'}, calendarDayText: {color: '#263052', fontSize: 13}, calendarDayTextSelected: {color: '#FFFFFF', fontWeight: '600'},
  label: {color: '#172044', fontFamily: Platform.select({android: 'sans-serif', ios: 'System'}), fontSize: 11, fontWeight: '400', marginTop: 8, marginBottom: 5}, required: {color: '#FF3F4F'},
  inputBox: {height: 44, borderWidth: 1.3, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FDFDFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#4050C8', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1}, inputIconWrap: {width: 39, height: '100%', alignItems: 'center', justifyContent: 'center'}, inputIconImage: {width: 25, height: 25}, input: {flex: 1, height: '100%', color: '#11183A', fontFamily: Platform.select({android: 'sans-serif', ios: 'System'}), fontSize: 11.5, fontWeight: '400', paddingHorizontal: 5, paddingVertical: 0},
  salonTypeField: {height: 44, borderWidth: 1.3, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FDFDFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, salonTypeText: {flex: 1, color: '#11183A', fontFamily: Platform.select({android: 'sans-serif', ios: 'System'}), fontSize: 11.5, fontWeight: '400'}, salonTypePlaceholder: {color: '#69718F'}, salonTypeOptions: {borderWidth: 1, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FFFFFF', marginTop: 4, overflow: 'hidden'}, salonTypeOption: {height: 38, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#EEF0F5'}, salonTypeOptionText: {color: '#172044', fontSize: 11.5, fontWeight: '400'}, salonTypeOptionSelected: {color: '#4D32F4', fontWeight: '500'},
  phoneRow: {flexDirection: 'row', gap: 8}, countryCode: {width: 76, height: 44, borderWidth: 1.3, borderColor: '#D7DBE8', borderRadius: 9, backgroundColor: '#FDFDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, shadowColor: '#4050C8', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1}, countryText: {color: '#172044', fontSize: 12, fontWeight: '400'}, down: {width: 15, height: 10, position: 'relative'}, downLeft: {position: 'absolute', left: 0, top: 2, width: 10, height: 3, borderRadius: 2, backgroundColor: '#6D7693', transform: [{rotate: '45deg'}]}, downRight: {position: 'absolute', right: 0, top: 2, width: 10, height: 3, borderRadius: 2, backgroundColor: '#6D7693', transform: [{rotate: '-45deg'}]}, phoneInput: {flex: 1}, whatsappIconImage: {width: 25, height: 25},
  helper: {color: '#505A78', fontSize: 10, marginTop: 5}, flexSpace: {flex: 1, minHeight: 45},
  saveButton: {height: 46, marginHorizontal: -3, borderRadius: 9, borderWidth: 1.2, borderColor: '#17245A', backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center', shadowColor: '#07113D', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.18, shadowRadius: 6, elevation: 4}, saveButtonDisabled: {opacity: 0.65}, savePressed: {opacity: 0.9}, saveText: {color: '#FFFFFF', fontSize: 13, fontWeight: '400'},
});

export default AddLeadScreen;
