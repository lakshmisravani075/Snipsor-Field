import React, {useState} from 'react';
import {
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

const shopIcon = require('../../assets/icons/detail-shop.png');
const contactIcon = require('../../assets/icons/detail-contact.png');
const phoneIcon = require('../../assets/icons/detail-phone.png');
const whatsappIcon = require('../../assets/icons/detail-whatsapp.png');
const emailIcon = require('../../assets/icons/detail-email.png');
const locationIcon = require('../../assets/icons/detail-location.png');
const notesIcon = require('../../assets/icons/detail-calendar.png');
const interestedStatusIcon = require('../../assets/icons/status-interested.png');
const notInterestedStatusIcon = require('../../assets/icons/status-not-interested.png');
const followUpStatusIcon = require('../../assets/icons/status-follow-up.png');
const locationMapPreview = require('../../assets/images/relative/location-map-preview.png');

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

function LeadDetailsScreen({lead, onBack, onUpdateStatus}) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead.status || 'Interested');
  const contactPerson = lead.person || 'New Contact';
  const contactEmail = `${contactPerson.toLowerCase().trim().replace(/\s+/g, '.')}@email.com`;
  const statusDetails = currentStatus === 'Follow-up'
    ? {icon: followUpStatusIcon, description: 'We will follow up with this salon later'}
    : currentStatus === 'Not Interested'
      ? {icon: notInterestedStatusIcon, description: 'Salon is not interested right now'}
      : {icon: interestedStatusIcon, description: 'Salon is interested in joining Snipsor'};

  const openLocation = () => {
    const locationQuery = encodeURIComponent(lead.location);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${locationQuery}`);
  };

  const openLeadHistory = () => {
    setIsViewingHistory(true);
  };

  if (isUpdatingStatus) {
    return (
      <UpdateStatusScreen
        currentStatus={currentStatus}
        followup={lead.followup}
        onBack={() => setIsUpdatingStatus(false)}
        onSave={status => {
          setCurrentStatus(status);
          setIsUpdatingStatus(false);
        }}
      />
    );
  }

  if (isViewingHistory) {
    return <LeadHistoryScreen lead={lead} status={currentStatus} onBack={() => setIsViewingHistory(false)} />;
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
            <View style={styles.summaryText}><Text style={styles.leadName}>{lead.name}</Text><Text style={styles.added}>Added on 25 Aug 2026, 11:30 AM</Text></View>
            <View style={[styles.status, {backgroundColor: currentStatus === 'Interested' ? '#DDF9E8' : currentStatus === 'Follow-up' ? '#FFF0EA' : '#FFECEF'}]}><Text style={[styles.statusText, {color: currentStatus === 'Interested' ? '#20B967' : currentStatus === 'Follow-up' ? '#FF6B2C' : '#FF3F4F'}]}>{currentStatus}</Text></View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={contactIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Contact Information</Text></View>
          <DetailRow icon={contactIcon} label="Contact Person" value={contactPerson} />
          <DetailRow icon={phoneIcon} label="Phone Number" value={lead.phone} />
          <DetailRow icon={whatsappIcon} iconTint="#18A957" label="WhatsApp Number" value={lead.phone} />
          <DetailRow icon={emailIcon} label="Email" value={contactEmail} isLast />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={locationIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Location</Text></View>
          <View style={styles.locationRow}>
            <Text style={styles.locationText}>{lead.location},{'\n'}Telangana - 500072</Text>
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${lead.location} in Google Maps`} hitSlop={8} onPress={openLocation} style={({pressed}) => [styles.map, pressed && styles.mapPressed]}>
              <Image source={locationMapPreview} resizeMode="cover" style={styles.mapImage} />
              <View style={styles.openMapsButton}><Text style={styles.openMapsText}>Open in Maps</Text></View>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={notesIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Notes</Text></View>
          <View style={styles.notesRow}><Text style={styles.notes}>Owner is interested in joining Snipsor.{`\n`}Currently managing 8 members.{`\n`}Wants digital booking.</Text><Pressable><Text style={styles.viewMore}>View more</Text></Pressable></View>
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
  header: {height: 58, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10}, backButton: {width: 27, height: 32, justifyContent: 'center'}, backArrow: {width: 19, height: 16, justifyContent: 'center'}, backArrowLine: {width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF'}, backArrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '-45deg'}]}, backArrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]}, headerTitle: {color: '#FFFFFF', fontSize: 17, fontWeight: '400'},
  content: {paddingHorizontal: 2, paddingBottom: 20},
  summaryBackdrop: {marginHorizontal: -2, position: 'relative'}, summaryCornerBackdrop: {position: 'absolute', top: 0, left: 0, right: 0, height: 65, backgroundColor: '#07113D', borderBottomLeftRadius: 8, borderBottomRightRadius: 8},
  summaryCard: {minHeight: 108, marginHorizontal: 8, marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1.2, borderColor: '#E1E5EF', paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', shadowColor: '#28345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.1, shadowRadius: 7, elevation: 4},
  shopIconTile: {width: 58, height: 58, borderRadius: 13, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'}, shopIconImage: {width: 47, height: 47, tintColor: '#3820C9'},
  summaryText: {flex: 1, marginLeft: 14}, leadName: {color: '#11183A', fontSize: 20, fontWeight: '400'}, added: {color: '#606984', fontSize: 13, marginTop: 8}, status: {height: 29, borderRadius: 7, paddingHorizontal: 10, justifyContent: 'center'}, statusText: {fontSize: 13, fontWeight: '400'},
  sectionCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E6F0', marginHorizontal: 2, marginTop: 10, shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3}, sectionHeading: {height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, headingIconImage: {width: 31, height: 31, marginRight: 11, tintColor: '#3820C9'}, sectionTitle: {color: '#1C254D', fontSize: 15, fontWeight: '400'},
  detailRow: {minHeight: 70, borderBottomWidth: 1, borderBottomColor: '#EEF0F5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, detailRowLast: {borderBottomWidth: 0}, rowIconWrap: {width: 41, alignItems: 'flex-start'}, rowIconImage: {width: 30, height: 30, tintColor: '#3820C9'}, rowContent: {flex: 1}, rowLabel: {color: '#69718D', fontSize: 14}, rowValue: {color: '#172047', fontSize: 15, fontWeight: '400', marginTop: 4},
  locationRow: {minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 10}, locationText: {color: '#263052', fontSize: 14, fontWeight: '400', lineHeight: 21}, map: {width: 104, height: 76, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EDF1F5'}, mapImage: {width: '100%', height: '100%'}, openMapsButton: {position: 'absolute', left: 8, right: 8, bottom: 7, height: 24, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#172047', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.14, shadowRadius: 2, elevation: 2}, openMapsText: {color: '#4935D4', fontSize: 9.5, fontWeight: '600'}, mapPressed: {opacity: 0.8},
  notesRow: {minHeight: 101, paddingHorizontal: 28, paddingBottom: 11, flexDirection: 'row', alignItems: 'flex-end'}, notes: {flex: 1, color: '#283253', fontSize: 13.5, fontWeight: '400', lineHeight: 20}, viewMore: {color: '#4D32F4', fontSize: 13, fontWeight: '400'},
  salonStatusSection: {marginHorizontal: 10, marginTop: 15}, salonStatusHeading: {color: '#1C254D', fontSize: 14, fontWeight: '500', marginBottom: 8}, salonStatusCard: {minHeight: 66, borderRadius: 10, borderWidth: 1, borderColor: '#E2E6F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, salonStatusIcon: {width: 27, height: 27}, salonStatusText: {flex: 1, marginLeft: 12}, salonStatusTitle: {color: '#172047', fontSize: 14, fontWeight: '600'}, salonStatusDescription: {color: '#606984', fontSize: 11.5, marginTop: 4},
  detailActions: {flexDirection: 'row', gap: 10, marginHorizontal: 10, marginTop: 14}, detailActionButton: {flex: 1, height: 48, borderRadius: 8, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center'}, detailActionPressed: {opacity: 0.85}, detailActionText: {color: '#FFFFFF', fontSize: 14, fontWeight: '500'},
});

export default LeadDetailsScreen;
