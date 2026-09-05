import React from 'react';
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
import {Ionicons} from '@react-native-vector-icons/ionicons/static';

const mapPreview = require('../../../assets/images/relative/location-map-preview.png');
const shopIcon = require('../../../assets/icons/detail-shop.png');
const locationIcon = require('../../../assets/icons/detail-location.png');
const contactIcon = require('../../../assets/icons/detail-contact.png');
const phoneIcon = require('../../../assets/icons/detail-phone.png');
const whatsappIcon = require('../../../assets/icons/detail-whatsapp.png');
const leadIdIcon = require('../../../assets/icons/onboarding-lead-id.png');
const assignedToIcon = require('../../../assets/icons/onboarding-assigned-to.png');
const leadSourceIcon = require('../../../assets/icons/onboarding-lead-source.png');
const assignedOnIcon = require('../../../assets/icons/onboarding-assigned-on.png');
const mapPinIcon = require('../../../assets/icons/onboarding-map-pin.png');

function DetailIcon({source, size = 15, tintColor}) {
  return <Image source={source} resizeMode="contain" style={{width: size, height: size, tintColor}} />;
}

function MetaItem({icon, label, value}) {
  return (
    <View style={styles.metaItem}>
      <DetailIcon source={icon} size={22} />
      <View style={styles.metaCopy}><Text style={styles.metaLabel}>{label}</Text><Text numberOfLines={1} style={styles.metaValue}>{value}</Text></View>
    </View>
  );
}

function InfoRow({icon, label, value}) {
  return (
    <View style={styles.infoRow}>
      <DetailIcon source={icon} size={24} tintColor="#07113D" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TaskDetailsScreen({task, fromSalons = false, onBack, onContinue}) {
  const compactPhone = task.phone.replace(/\s/g, '');
  const address = `12, Main Road, ${task.location}`;
  const handleCall = () => Linking.openURL(`tel:+91${compactPhone}`);
  const handleNavigate = () => {
    const destination = encodeURIComponent(`${task.name}, ${address}`);
    return Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to tasks" hitSlop={12} onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#0A153E" /></Pressable>
        <Text style={styles.headerTitle}>{fromSalons ? 'Salon Details' : 'Task Details'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.salonRow}>
            <View style={styles.shopTile}><Image source={shopIcon} resizeMode="contain" style={styles.shopImage} /></View>
            <View style={styles.salonCopy}>
              <Text style={styles.salonName}>{task.name}</Text>
              <Text style={styles.businessType}>Unisex Salon</Text>
              <View style={styles.addressRow}><DetailIcon source={locationIcon} size={12} /><Text numberOfLines={2} style={styles.address}>{address}</Text></View>
              <View style={styles.distanceRow}><Ionicons name="navigate-outline" size={11} color="#6546EC" /><Text style={styles.distance}>{task.activity}</Text></View>
            </View>
          </View>

          <View style={styles.primaryActions}>
            <Pressable accessibilityLabel={`Call ${task.name}`} accessibilityRole="button" onPress={handleCall} style={({pressed}) => [styles.primaryButton, pressed && styles.pressed]}><Ionicons name="call-outline" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Call</Text></Pressable>
            <Pressable accessibilityLabel={`Navigate to ${task.name}`} accessibilityRole="button" onPress={handleNavigate} style={({pressed}) => [styles.secondaryButton, pressed && styles.pressed]}><Ionicons name="navigate-outline" size={18} color="#101C4D" /><Text style={styles.secondaryButtonText}>Navigate</Text></Pressable>
          </View>

          <View style={styles.metaGrid}>
            <MetaItem icon={leadIdIcon} label="Lead ID" value={task.leadId} />
            <MetaItem icon={assignedToIcon} label="Assigned To" value={task.assignee} />
            <MetaItem icon={leadSourceIcon} label="Lead Source" value="Walk-in" />
            <MetaItem icon={assignedOnIcon} label="Assigned On" value="12 May 2026" />
          </View>

          <View style={styles.mapWrap}>
            <Image source={mapPreview} resizeMode="cover" style={styles.map} />
            <Image source={mapPinIcon} resizeMode="contain" style={styles.mapPin} />
            <Pressable accessibilityLabel={`Open ${task.name} in maps`} accessibilityRole="button" onPress={handleNavigate} style={({pressed}) => [styles.openMapButton, pressed && styles.pressed]}><Ionicons name="open-outline" size={16} color="#FFFFFF" /><Text style={styles.openMapText}>Open in Maps</Text></Pressable>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeading}><View style={styles.sectionIcon}><DetailIcon source={contactIcon} size={23} tintColor="#FFFFFF" /></View><Text style={styles.sectionTitle}>Lead Information</Text></View>
          <InfoRow icon={contactIcon} label="Contact Person" value={task.contact} />
          <InfoRow icon={phoneIcon} label="Phone Number" value={`+91 ${compactPhone}`} />
          <InfoRow icon={whatsappIcon} label="WhatsApp Number" value={`+91 ${compactPhone}`} />
          <InfoRow icon={shopIcon} label="Business Type" value="Unisex Salon" />
        </View>
      </ScrollView>

      <View style={styles.bottomActionWrap}>
        <Pressable onPress={onContinue} style={({pressed}) => [styles.continueButton, pressed && styles.pressed]}><View style={styles.continueLabel}><Ionicons name="play-circle-outline" size={18} color="#FFFFFF" /><Text style={styles.continueText}>{task.status === 'New' ? 'Start Onboarding' : 'Continue Onboarding'}</Text></View><Ionicons name="chevron-forward" size={17} color="#FFFFFF" /></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 58, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECEEF4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16},
  backButton: {width: 30, height: 36, justifyContent: 'center', marginRight: 9},
  backArrow: {color: '#0A153E', fontSize: 19, lineHeight: 24, fontWeight: '400'},
  headerTitle: {color: '#101735', fontSize: 15, fontFamily: 'Poppins_600SemiBold', marginLeft: 2},
  content: {padding: 14, paddingBottom: 18},
  heroCard: {backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E8F0', borderRadius: 12, padding: 12},
  salonRow: {flexDirection: 'row'},
  shopTile: {width: 72, height: 72, borderRadius: 9, backgroundColor: '#F3F0FF', alignItems: 'center', justifyContent: 'center'},
  shopImage: {width: 50, height: 50},
  salonCopy: {flex: 1, marginLeft: 13},
  salonName: {color: '#101735', fontSize: 16, fontFamily: 'Poppins_600SemiBold'},
  businessType: {color: '#404760', fontSize: 9.5, marginTop: 4},
  addressRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 5},
  distanceRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5},
  address: {flex: 1, color: '#363D57', fontSize: 9, lineHeight: 13, marginLeft: 5},
  distance: {color: '#17255B', fontSize: 9, fontFamily: 'Inter_400Regular'},
  primaryActions: {flexDirection: 'row', marginTop: 13},
  primaryButton: {flex: 1, height: 38, borderRadius: 6, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  secondaryButton: {flex: 1, height: 38, borderRadius: 6, borderWidth: 1, borderColor: '#263870', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginLeft: 9},
  primaryButtonText: {color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_500Medium'},
  secondaryButtonText: {color: '#101C4D', fontSize: 11, fontWeight: '500'},
  callButtonIcon: {width: 25, height: 25},
  navigateButtonIcon: {width: 23, height: 23},
  metaGrid: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 1},
  metaItem: {width: '24%', flexDirection: 'row', alignItems: 'flex-start'},
  metaCopy: {flex: 1, marginLeft: 4},
  metaLabel: {color: '#8B90A4', fontSize: 6.5, fontFamily: 'Inter_400Regular'},
  metaValue: {color: '#1E284F', fontSize: 7.5, fontFamily: 'Inter_500Medium', marginTop: 2},
  mapWrap: {height: 105, borderRadius: 8, overflow: 'hidden', marginTop: 14, backgroundColor: '#EEF2EC'},
  map: {width: '100%', height: '100%'},
  mapPin: {position: 'absolute', left: '46%', top: 25, width: 34, height: 42},
  openMapButton: {position: 'absolute', right: 8, bottom: 8, height: 30, borderRadius: 6, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingLeft: 6, paddingRight: 11},
  externalLinkIcon: {width: 24, height: 24, marginRight: 6},
  openMapText: {color: '#FFFFFF', fontSize: 8.5, fontWeight: '500'},
  infoCard: {backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E8F0', borderRadius: 12, padding: 12, marginTop: 12},
  sectionHeading: {flexDirection: 'row', alignItems: 'center', marginBottom: 5},
  sectionIcon: {width: 38, height: 38, borderRadius: 8, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center'},
  sectionTitle: {color: '#111936', fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginLeft: 9},
  infoRow: {height: 40, borderBottomWidth: 1, borderBottomColor: '#F0F1F5', flexDirection: 'row', alignItems: 'center'},
  infoLabel: {color: '#5D647D', fontSize: 10.5, marginLeft: 10, fontFamily: 'Inter_400Regular'},
  infoValue: {flex: 1, color: '#182246', fontSize: 10.5, fontFamily: 'Inter_500Medium', textAlign: 'right'},
  bottomActionWrap: {height: 69, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EE', paddingHorizontal: 14, paddingTop: 9},
  continueButton: {height: 45, borderRadius: 7, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13},
  continueLabel: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  continueIcon: {width: 24, height: 24, marginRight: 9},
  continueText: {color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold'},
  continueArrow: {color: '#FFFFFF', fontSize: 25, lineHeight: 25},
  pressed: {opacity: 0.86},
});

export default TaskDetailsScreen;
