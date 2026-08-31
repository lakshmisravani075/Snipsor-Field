import React from 'react';
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

const shopIcon = require('../../assets/icons/detail-shop.png');

function TimelineItem({color, title, date, author, isLast}) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, {borderColor: color}]}><View style={[styles.timelineDotCenter, {backgroundColor: color}]} /></View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.eventTitle}>{title}</Text>
        <Text style={styles.eventDate}>{date}</Text>
        <Text style={styles.eventAuthor}>By {author} (You)</Text>
      </View>
    </View>
  );
}

function LeadHistoryScreen({lead, status, onBack}) {
  const statusColor = status === 'Interested' ? '#20B967' : status === 'Follow-up' ? '#FF781F' : '#FF3F4F';
  const statusBackground = status === 'Interested' ? '#DDF9E8' : status === 'Follow-up' ? '#FFF0E8' : '#FFECEF';
  const author = lead.person || 'Field Executive';
  const history = [
    {color: '#20B967', title: 'Lead Created', date: '24 May 2026, 10:30 AM'},
    ...(status === 'Follow-up'
      ? [
          {color: '#FF8A1F', title: 'Marked as Follow Up', date: '24 May 2026, 10:35 AM'},
          {color: '#4D32F4', title: 'Follow Up Scheduled', date: `${lead.followup || '25 May 2026'}, 04:00 PM`},
        ]
      : [{color: statusColor, title: `Marked as ${status}`, date: '24 May 2026, 10:35 AM'}]),
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to lead details" hitSlop={12} onPress={onBack} style={styles.backButton}>
          <View style={styles.backArrow}><View style={styles.arrowLine} /><View style={styles.arrowTop} /><View style={styles.arrowBottom} /></View>
        </Pressable>
        <Text style={styles.headerTitle}>Lead History</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.leadCard}>
          <View style={styles.iconTile}><Image source={shopIcon} resizeMode="contain" style={styles.shopIcon} /></View>
          <View style={styles.leadText}>
            <Text style={styles.leadName}>{lead.name}</Text>
            <Text style={styles.leadLocation}>{lead.location}</Text>
            <Text style={styles.leadId}>Lead ID: LD-2026-{String(lead.phone || '').slice(-5).padStart(5, '0')}</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: statusBackground}]}><Text style={[styles.statusText, {color: statusColor}]}>{status}</Text></View>
        </View>

        <Text style={styles.timelineHeading}>Timeline</Text>
        <View style={styles.timelineList}>
          {history.map((item, index) => <TimelineItem key={`${item.title}-${index}`} {...item} author={author} isLast={index === history.length - 1} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F8F9FC'},
  header: {height: 58, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, backButton: {width: 34, height: 40, justifyContent: 'center'}, backArrow: {width: 20, height: 16, justifyContent: 'center'}, arrowLine: {width: 19, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF'}, arrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '-45deg'}]}, arrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]}, headerTitle: {color: '#FFFFFF', fontSize: 17, fontWeight: '500'},
  content: {paddingHorizontal: 15, paddingTop: 14, paddingBottom: 28}, leadCard: {minHeight: 92, borderRadius: 12, borderWidth: 1, borderColor: '#E3E7F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, shadowColor: '#25315C', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2}, iconTile: {width: 48, height: 48, borderRadius: 10, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'}, shopIcon: {width: 36, height: 36, tintColor: '#452EE5'}, leadText: {flex: 1, marginLeft: 11}, leadName: {color: '#121A40', fontSize: 15, fontWeight: '600'}, leadLocation: {color: '#5F6884', fontSize: 12, marginTop: 4}, leadId: {color: '#3C4668', fontSize: 11, marginTop: 5}, statusBadge: {borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6}, statusText: {fontSize: 11, fontWeight: '500'},
  timelineHeading: {color: '#1C254D', fontSize: 15, fontWeight: '600', marginTop: 24, marginBottom: 17}, timelineList: {paddingHorizontal: 10}, timelineItem: {minHeight: 96, flexDirection: 'row'}, timelineRail: {width: 35, alignItems: 'center'}, timelineDot: {width: 20, height: 20, borderRadius: 10, borderWidth: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'}, timelineDotCenter: {width: 5, height: 5, borderRadius: 3}, timelineLine: {width: 2, flex: 1, backgroundColor: '#BCC3D8'}, timelineContent: {flex: 1, paddingLeft: 7, paddingBottom: 23}, eventTitle: {color: '#172047', fontSize: 14, fontWeight: '600'}, eventDate: {color: '#374160', fontSize: 12.5, fontWeight: '500', marginTop: 7}, eventAuthor: {color: '#68718C', fontSize: 12, marginTop: 6},
});

export default LeadHistoryScreen;
