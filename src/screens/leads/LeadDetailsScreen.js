import React, {useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import UpdateStatusScreen from './UpdateStatusScreen.js';
import LeadHistoryScreen from './LeadHistoryScreen.js';
import {leadService} from '../../services/apiService.js';

const shopIcon = require('../../assets/icons/detail-shop.png');
const contactIcon = require('../../assets/icons/detail-contact.png');
const phoneIcon = require('../../assets/icons/detail-phone.png');
const whatsappIcon = require('../../assets/icons/detail-whatsapp.png');
const locationIcon = require('../../assets/icons/detail-location.png');
const interestedStatusIcon = require('../../assets/icons/status-interested.png');
const notInterestedStatusIcon = require('../../assets/icons/status-not-interested.png');
const followUpStatusIcon = require('../../assets/icons/status-follow-up.png');
const locationMapPreview = require('../../assets/images/relative/location-map-preview.png');

const normalizeStatus = value => {
  const status = String(value || '').toUpperCase().replace(/[ -]+/g, '_');
  if (status === 'FOLLOW_UP') {
    return 'Follow-up';
  }
  if (status === 'NOT_INTERESTED') {
    return 'Not Interested';
  }
  return status === 'INTERESTED' ? 'Interested' : String(value || '');
};

const findNoteValue = source => {
  const noteKeys = new Set(['followupnote', 'followupnotes', 'note', 'notes']);
  const pending = [{value: source, depth: 0}];
  const visited = new Set();
  while (pending.length > 0) {
    const {value, depth} = pending.shift();
    if (!value || typeof value !== 'object' || visited.has(value) || depth > 4) {
      continue;
    }
    visited.add(value);
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
      if (noteKeys.has(normalizedKey) && typeof nestedValue === 'string' && nestedValue.trim()) {
        return nestedValue.trim();
      }
      if (nestedValue && typeof nestedValue === 'object') {
        pending.push({value: nestedValue, depth: depth + 1});
      }
    }
  }
  return '';
};

const normalizeLeadDetails = (record, summary) => {
  const acquisition = record.acquisition || record.acquisition_details || record.acquisitionDetails || {};
  const followUp = record.follow_up || record.followUp || {};
  const address = record.address;
  const addressText = typeof address === 'string'
    ? address
    : address?.complete_address || address?.completeAddress || address?.formatted_address || address?.formattedAddress || '';

  return {
    ...summary,
    ...record,
    id: record.id || record.lead_id || record.leadId || summary.id,
    name: record.salon_name || record.salonName || summary.name || '',
    location: addressText || record.complete_address || record.completeAddress || summary.location || '',
    pincode: record.pincode || record.pin_code || record.postcode || record.postal_code || record.postalCode || address?.pincode || address?.postcode || address?.postal_code || summary.pincode || '',
    person: record.contact_person || record.contactPerson || record.contact_person_name || record.contactPersonName || summary.person || '',
    phone: record.phone_number || record.phoneNumber || summary.phone || '',
    whatsapp: record.whatsapp_number || record.whatsappNumber || summary.whatsapp || '',
    notes: record.follow_up_note || record.followUpNote || record.follow_up_notes || record.note || record.notes || acquisition.follow_up_note || acquisition.followUpNote || acquisition.note || acquisition.notes || findNoteValue(record) || summary.notes || '',
    followup: String(record.follow_up_date || record.followUpDate || followUp.follow_up_date || acquisition.follow_up_date || acquisition.followUpDate || summary.followup || '').replace(/T.*$/, ''),
    followupTime: record.follow_up_time || record.followUpTime || followUp.follow_up_time || acquisition.follow_up_time || acquisition.followUpTime || summary.followupTime || '',
    createdAt: record.created_at || record.createdAt || summary.createdAt || '',
    status: normalizeStatus(record.status || summary.status),
  };
};

const extractLeadDetails = response => {
  const container = response?.data && typeof response.data === 'object' ? response.data : response;
  const leadRecord = container?.lead || container?.data || response?.lead || container;
  return leadRecord && typeof leadRecord === 'object'
    ? {...container, ...leadRecord}
    : {};
};

function DetailRow({icon, label, value, isLast, iconTint}) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <View style={styles.rowIconWrap}><Image source={icon} resizeMode="contain" style={[styles.rowIconImage, iconTint && {tintColor: iconTint}]} /></View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function LeadDetailsScreen({lead, onBack, onUpdateStatus, onStatusUpdated, onSessionExpired}) {
  const [details, setDetails] = useState(lead);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead.status || 'Interested');
  const contactPerson = details.person || '';
  const locationText = details.pincode && !String(details.location || '').includes(String(details.pincode))
    ? [details.location, details.pincode].filter(Boolean).join(', ')
    : details.location || '';
  const createdDate = details.createdAt
    ? new Date(details.createdAt).toLocaleString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})
    : '';
  const statusDetails = currentStatus === 'Follow-up'
    ? {icon: followUpStatusIcon, description: 'We will follow up with this salon later'}
    : currentStatus === 'Not Interested'
      ? {icon: notInterestedStatusIcon, description: 'Salon is not interested right now'}
      : {icon: interestedStatusIcon, description: 'Salon is interested in joining Snipsor'};

  useEffect(() => {
    if (!lead.id) {
      return undefined;
    }
    let isMounted = true;
    const loadLeadDetails = async () => {
      try {
        const [detailsResult, timelineResult] = await Promise.allSettled([
          leadService.getLeadDetails(lead.id),
          leadService.getAcquisitionTimeline(lead.id),
        ]);
        if (detailsResult.status === 'rejected') {
          throw detailsResult.reason;
        }
        if (isMounted) {
          const timelineData = timelineResult.status === 'fulfilled' ? timelineResult.value : null;
          const normalizedDetails = normalizeLeadDetails(
            {...extractLeadDetails(detailsResult.value), timeline: timelineData},
            lead,
          );
          setDetails(normalizedDetails);
          setCurrentStatus(normalizedDetails.status || 'Interested');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        if (error?.status === 401) {
          Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
          return;
        }
        Alert.alert('Unable to load lead details', error?.message || 'Please try again.');
      }
    };
    loadLeadDetails();
    return () => {
      isMounted = false;
    };
  }, [lead, onSessionExpired]);

  const openLocation = () => {
    const locationQuery = encodeURIComponent(locationText);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${locationQuery}`);
  };

  const openLeadHistory = () => {
    setIsViewingHistory(true);
  };

  if (isUpdatingStatus) {
    return (
      <UpdateStatusScreen
        leadId={details.id || lead.id}
        currentStatus={currentStatus}
        followup={details.followup}
        followupTime={details.followupTime}
        onBack={() => setIsUpdatingStatus(false)}
        onSessionExpired={onSessionExpired}
        onSave={(status, response, submittedPayload) => {
          const updatedRecord = extractLeadDetails(response);
          const recordWithSubmittedNote = {
            ...(updatedRecord && typeof updatedRecord === 'object' ? updatedRecord : {}),
            ...submittedPayload,
          };
          setDetails(previous => normalizeLeadDetails(recordWithSubmittedNote, previous));
          setCurrentStatus(status);
          onStatusUpdated?.(details.id || lead.id, status, recordWithSubmittedNote);
          setIsUpdatingStatus(false);
        }}
      />
    );
  }

  if (isViewingHistory) {
    return <LeadHistoryScreen lead={details} status={currentStatus} onBack={() => setIsViewingHistory(false)} onSessionExpired={onSessionExpired} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to leads" hitSlop={12} onPress={onBack} style={styles.backButton}>
          <View style={styles.backArrow}>
            <View style={styles.backArrowLine} />
            <View style={styles.backArrowTop} />
            <View style={styles.backArrowBottom} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Lead Details</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.summaryBackdrop}>
          <View style={styles.summaryCornerBackdrop} />
          <View style={styles.summaryCard}>
            <View style={styles.shopIconTile}><Image source={shopIcon} resizeMode="contain" style={styles.shopIconImage} /></View>
            <View style={styles.summaryText}><Text style={styles.leadName}>{details.name}</Text><Text style={styles.added}>{createdDate ? `Added on ${createdDate}` : ''}</Text></View>
            <View style={[styles.status, {backgroundColor: currentStatus === 'Interested' ? '#DDF9E8' : currentStatus === 'Follow-up' ? '#FFF0EA' : '#FFECEF'}]}><Text style={[styles.statusText, {color: currentStatus === 'Interested' ? '#20B967' : currentStatus === 'Follow-up' ? '#FF6B2C' : '#FF3F4F'}]}>{currentStatus}</Text></View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={contactIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Contact Information</Text></View>
          <DetailRow icon={contactIcon} label="Contact Person" value={contactPerson} />
          <DetailRow icon={phoneIcon} label="Phone Number" value={details.phone} />
          <DetailRow icon={whatsappIcon} iconTint="#18A957" label="WhatsApp Number" value={details.whatsapp || details.phone} isLast />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={locationIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Location</Text></View>
          <View style={styles.locationRow}>
            <Text numberOfLines={2} style={styles.locationText}>{locationText}</Text>
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${locationText} in Google Maps`} hitSlop={8} onPress={openLocation} style={({pressed}) => [styles.map, pressed && styles.mapPressed]}>
              <Image source={locationMapPreview} resizeMode="cover" style={styles.mapImage} />
              <View style={styles.openMapsButton}><Text style={styles.openMapsText}>Open in Maps</Text></View>
            </Pressable>
          </View>
        </View>

        <View style={styles.salonStatusSection}>
          <Text style={styles.salonStatusHeading}>Salon Status</Text>
          <View style={styles.salonStatusCard}>
            <Image source={statusDetails.icon} resizeMode="contain" style={styles.salonStatusIcon} />
            <View style={styles.salonStatusText}>
              <Text style={styles.salonStatusTitle}>{currentStatus}</Text>
              <Text style={styles.salonStatusDescription}>{statusDetails.description}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="View lead history" hitSlop={6} onPress={openLeadHistory} style={({pressed}) => [styles.detailActionButton, pressed && styles.detailActionPressed]}>
            <Text style={styles.detailActionText}>View History</Text>
          </Pressable>
          <Pressable onPress={() => { setIsUpdatingStatus(true); onUpdateStatus?.(); }} style={({pressed}) => [styles.detailActionButton, pressed && styles.detailActionPressed]}>
            <Text style={styles.detailActionText}>Update Status</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 58, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10}, backButton: {width: 27, height: 32, justifyContent: 'center'}, backArrow: {width: 19, height: 16, justifyContent: 'center'}, backArrowLine: {width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF'}, backArrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '-45deg'}]}, backArrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]}, headerTitle: {color: '#FFFFFF', fontSize: 17, fontFamily: 'Poppins_600SemiBold'},
  content: {paddingHorizontal: 2, paddingBottom: 20},
  summaryBackdrop: {marginHorizontal: -2, position: 'relative'}, summaryCornerBackdrop: {position: 'absolute', top: 0, left: 0, right: 0, height: 65, backgroundColor: '#07113D', borderBottomLeftRadius: 8, borderBottomRightRadius: 8},
  summaryCard: {minHeight: 108, marginHorizontal: 8, marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1.2, borderColor: '#E1E5EF', paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', shadowColor: '#28345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.1, shadowRadius: 7, elevation: 4},
  shopIconTile: {width: 58, height: 58, borderRadius: 13, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'}, shopIconImage: {width: 47, height: 47, tintColor: '#3820C9'},
  summaryText: {flex: 1, marginLeft: 14}, leadName: {color: '#11183A', fontSize: 20, fontWeight: '400'}, added: {color: '#606984', fontSize: 13, marginTop: 8}, status: {height: 29, borderRadius: 7, paddingHorizontal: 10, justifyContent: 'center'}, statusText: {fontSize: 13, fontWeight: '400'},
  sectionCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E6F0', marginHorizontal: 2, marginTop: 10, shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3}, sectionHeading: {height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, headingIconImage: {width: 31, height: 31, marginRight: 11, tintColor: '#3820C9'}, sectionTitle: {color: '#1C254D', fontSize: 15, fontFamily: 'Poppins_600SemiBold'},
  detailRow: {minHeight: 70, borderBottomWidth: 1, borderBottomColor: '#EEF0F5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, detailRowLast: {borderBottomWidth: 0}, rowIconWrap: {width: 41, alignItems: 'flex-start'}, rowIconImage: {width: 30, height: 30, tintColor: '#3820C9'}, rowContent: {flex: 1}, rowLabel: {color: '#69718D', fontSize: 14}, rowValue: {color: '#172047', fontSize: 15, fontWeight: '400', marginTop: 4},
  locationRow: {minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 10}, locationText: {flex: 1, marginRight: 10, color: '#263052', fontSize: 14, fontWeight: '400', lineHeight: 21}, map: {width: 104, height: 76, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EDF1F5'}, mapImage: {width: '100%', height: '100%'}, openMapsButton: {position: 'absolute', left: 8, right: 8, bottom: 7, height: 24, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#172047', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.14, shadowRadius: 2, elevation: 2}, openMapsText: {color: '#4935D4', fontSize: 9.5, fontWeight: '600'}, mapPressed: {opacity: 0.8},
  salonStatusSection: {marginHorizontal: 10, marginTop: 15}, salonStatusHeading: {color: '#1C254D', fontSize: 14, fontWeight: '500', marginBottom: 8}, salonStatusCard: {minHeight: 66, borderRadius: 10, borderWidth: 1, borderColor: '#E2E6F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, salonStatusIcon: {width: 27, height: 27}, salonStatusText: {flex: 1, marginLeft: 12}, salonStatusTitle: {color: '#172047', fontSize: 14, fontWeight: '600'}, salonStatusDescription: {color: '#606984', fontSize: 11.5, marginTop: 4},
  detailActions: {flexDirection: 'row', gap: 10, marginHorizontal: 10, marginTop: 14}, detailActionButton: {flex: 1, height: 48, borderRadius: 8, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center'}, detailActionPressed: {opacity: 0.85}, detailActionText: {color: '#FFFFFF', fontSize: 14, fontWeight: '500'},
});

export default LeadDetailsScreen;
