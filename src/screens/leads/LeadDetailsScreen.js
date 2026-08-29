import React, {useState} from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FollowUpScreen from './FollowUpScreen.js';
import HandoffScreen from './HandoffScreen.js';

const shopIcon = require('../../assets/icons/detail-shop.png');
const contactIcon = require('../../assets/icons/detail-contact.png');
const phoneIcon = require('../../assets/icons/detail-phone.png');
const whatsappIcon = require('../../assets/icons/detail-whatsapp.png');
const emailIcon = require('../../assets/icons/detail-email.png');
const locationIcon = require('../../assets/icons/detail-location.png');
const notesIcon = require('../../assets/icons/detail-calendar.png');
const calendarIcon = require('../../assets/icons/detail-notes.png');
const editIcon = require('../../assets/icons/detail-edit.png');

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

function LeadDetailsScreen({lead, onBack}) {
  const [isEditingFollowup, setIsEditingFollowup] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);

  if (isHandoffOpen) {
    return <HandoffScreen lead={lead} onBack={() => setIsHandoffOpen(false)} />;
  }

  if (isEditingFollowup) {
    return <FollowUpScreen lead={lead} onBack={() => setIsEditingFollowup(false)} />;
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
            <View style={[styles.status, {backgroundColor: lead.status === 'Interested' ? '#DDF9E8' : lead.status === 'Follow-up' ? '#FFF0EA' : '#E8F2FF'}]}><Text style={[styles.statusText, {color: lead.color}]}>{lead.status}</Text></View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={contactIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Contact Information</Text></View>
          <DetailRow icon={contactIcon} label="Contact Person" value={lead.person} />
          <DetailRow icon={phoneIcon} label="Phone Number" value={lead.phone} />
          <DetailRow icon={whatsappIcon} iconTint="#18A957" label="WhatsApp Number" value={lead.phone} />
          <DetailRow icon={emailIcon} label="Email" value={`${lead.person.toLowerCase().replace(' ', '.')}@email.com`} isLast />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={locationIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Location</Text></View>
          <View style={styles.locationRow}>
            <Text style={styles.locationText}>{lead.location},{'\n'}Telangana - 500072</Text>
            <View style={styles.map}><View style={styles.mapLineOne} /><View style={styles.mapLineTwo} /><View style={styles.pin}><View style={styles.pinDot} /></View></View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}><Image source={notesIcon} resizeMode="contain" style={styles.headingIconImage} /><Text style={styles.sectionTitle}>Notes</Text></View>
          <View style={styles.notesRow}><Text style={styles.notes}>Owner is interested in joining Snipsor.{`\n`}Currently managing 8 members.{`\n`}Wants digital booking.</Text><Pressable><Text style={styles.viewMore}>View more</Text></Pressable></View>
        </View>

        <View style={styles.followupCard}>
          <View style={styles.sectionHeading}><Image source={calendarIcon} resizeMode="contain" style={styles.headingIconImage} /><View><Text style={styles.rowLabel}>Next Follow-up</Text><Text style={styles.followupDate}>{lead.followup}</Text></View></View>
          <Pressable accessibilityLabel="Edit follow-up" onPress={() => setIsEditingFollowup(true)} style={styles.editButton}><Image source={editIcon} resizeMode="contain" style={styles.editIconImage} /></Pressable>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.callButton]}><Image source={phoneIcon} resizeMode="contain" style={[styles.actionIcon, styles.callActionIcon]} /><Text style={styles.callText}>Call</Text></Pressable>
        <Pressable style={[styles.actionButton, styles.whatsappButton]}><Image source={whatsappIcon} resizeMode="contain" style={[styles.actionIcon, styles.whatsappActionIcon]} /><Text style={styles.whatsappText}>WhatsApp</Text></Pressable>
        <Pressable onPress={() => setIsHandoffOpen(true)} style={[styles.actionButton, styles.handoffButton]}><Text style={styles.handoffText}>Handoff to{`\n`}Onboarding</Text><Text style={styles.actionArrow}>→</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 58, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10}, backButton: {width: 27, height: 32, justifyContent: 'center'}, backArrow: {width: 19, height: 16, justifyContent: 'center'}, backArrowLine: {width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF'}, backArrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '-45deg'}]}, backArrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]}, headerTitle: {color: '#FFFFFF', fontSize: 17, fontWeight: '400'},
  content: {paddingHorizontal: 2, paddingBottom: 85},
  summaryBackdrop: {marginHorizontal: -2, position: 'relative'}, summaryCornerBackdrop: {position: 'absolute', top: 0, left: 0, right: 0, height: 65, backgroundColor: '#07113D', borderBottomLeftRadius: 8, borderBottomRightRadius: 8},
  summaryCard: {minHeight: 108, marginHorizontal: 8, marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1.2, borderColor: '#E1E5EF', paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', shadowColor: '#28345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.1, shadowRadius: 7, elevation: 4},
  shopIconTile: {width: 58, height: 58, borderRadius: 13, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'}, shopIconImage: {width: 47, height: 47, tintColor: '#3820C9'},
  summaryText: {flex: 1, marginLeft: 14}, leadName: {color: '#11183A', fontSize: 20, fontWeight: '400'}, added: {color: '#606984', fontSize: 13, marginTop: 8}, status: {height: 29, borderRadius: 7, paddingHorizontal: 10, justifyContent: 'center'}, statusText: {fontSize: 13, fontWeight: '400'},
  sectionCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E6F0', marginHorizontal: 2, marginTop: 10, shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3}, sectionHeading: {height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, headingIconImage: {width: 31, height: 31, marginRight: 11, tintColor: '#3820C9'}, sectionTitle: {color: '#1C254D', fontSize: 15, fontWeight: '400'},
  detailRow: {minHeight: 70, borderBottomWidth: 1, borderBottomColor: '#EEF0F5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, detailRowLast: {borderBottomWidth: 0}, rowIconWrap: {width: 41, alignItems: 'flex-start'}, rowIconImage: {width: 30, height: 30, tintColor: '#3820C9'}, rowContent: {flex: 1}, rowLabel: {color: '#69718D', fontSize: 14}, rowValue: {color: '#172047', fontSize: 15, fontWeight: '400', marginTop: 4},
  locationRow: {minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 10}, locationText: {color: '#263052', fontSize: 14, fontWeight: '400', lineHeight: 21}, map: {width: 82, height: 62, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EDF1F5', position: 'relative'}, mapLineOne: {position: 'absolute', width: 100, height: 2, backgroundColor: '#FFFFFF', top: 22, left: -8, transform: [{rotate: '-12deg'}]}, mapLineTwo: {position: 'absolute', width: 2, height: 80, backgroundColor: '#FFFFFF', left: 38, top: -8, transform: [{rotate: '15deg'}]}, pin: {position: 'absolute', left: 35, top: 21, width: 16, height: 20, borderRadius: 9, borderBottomLeftRadius: 2, backgroundColor: '#4E32F4', transform: [{rotate: '45deg'}], alignItems: 'center', justifyContent: 'center'}, pinDot: {width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF'},
  notesRow: {minHeight: 101, paddingHorizontal: 28, paddingBottom: 11, flexDirection: 'row', alignItems: 'flex-end'}, notes: {flex: 1, color: '#283253', fontSize: 13.5, fontWeight: '400', lineHeight: 20}, viewMore: {color: '#4D32F4', fontSize: 13, fontWeight: '400'},
  followupCard: {height: 84, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E6F0', marginHorizontal: 2, marginTop: 10, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3}, followupDate: {color: '#121A40', fontSize: 16, fontWeight: '400', marginTop: 4}, editButton: {width: 46, height: 46, borderRadius: 11, backgroundColor: '#EFEDFF', alignItems: 'center', justifyContent: 'center'}, editIconImage: {width: 34, height: 34, tintColor: '#3820C9'},
  actions: {height: 72, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E8F0', flexDirection: 'row', gap: 7, paddingHorizontal: 8, paddingVertical: 8}, actionButton: {borderRadius: 8, alignItems: 'center', justifyContent: 'center'}, callButton: {width: 70, borderWidth: 1.3, borderColor: '#4D32F4'}, whatsappButton: {width: 82, borderWidth: 1.3, borderColor: '#18A957'}, handoffButton: {flex: 1, backgroundColor: '#07113D', flexDirection: 'row', paddingHorizontal: 12}, actionIcon: {width: 27, height: 27}, callActionIcon: {tintColor: '#2D1DBA'}, whatsappActionIcon: {tintColor: '#18A957'}, callText: {color: '#4D32F4', fontSize: 13, fontWeight: '400', marginTop: 2}, whatsappText: {color: '#18A957', fontSize: 13, fontWeight: '400', marginTop: 2}, handoffText: {flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '400', textAlign: 'center'}, actionArrow: {color: '#FFFFFF', fontSize: 20},
});

export default LeadDetailsScreen;
