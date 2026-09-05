import React, {useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {leadService} from '../../services/apiService.js';

const shopIcon = require('../../assets/icons/detail-shop.png');

const extractTimeline = response => {
  const candidates = [
    response,
    response?.timeline,
    response?.history,
    response?.data,
    response?.data?.timeline,
    response?.data?.history,
    response?.data?.items,
    response?.items,
  ];
  return candidates.find(Array.isArray) || [];
};

const formatStatus = value => String(value || '')
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, character => character.toUpperCase());

const formatTimelineDate = value => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'});
};

const normalizeTimelineItem = item => {
  const statusValue = item.status || item.new_status || item.newStatus;
  const status = formatStatus(statusValue);
  const eventType = String(item.event_type || item.eventType || item.action || item.type || '').toUpperCase();
  const followUpDate = item.follow_up_date || item.followUpDate;
  const followUpTime = item.follow_up_time || item.followUpTime;
  const scheduledTitle = followUpDate
    ? `Follow-Up Scheduled for ${followUpDate}${followUpTime ? ` ${followUpTime}` : ''}`
    : '';
  const isFollowUpEvent = /FOLLOW[ _-]?UP/.test(eventType)
    || /follow[ _-]?up scheduled/i.test(item.title || item.message || '');
  const title = (isFollowUpEvent && scheduledTitle) || item.title || item.message
    || (eventType.includes('CREAT') ? 'Lead Created' : status ? `Marked as ${status}` : formatStatus(eventType));
  const authorData = item.updated_by || item.updatedBy || item.created_by || item.createdBy || item.user || {};
  const author = item.author || item.updated_by_name || item.updatedByName || item.created_by_name || item.createdByName
    || authorData.name || authorData.full_name || authorData.fullName || '';
  const normalizedStatus = String(statusValue || '').toUpperCase();
  const color = normalizedStatus === 'INTERESTED'
    ? '#20B967'
    : normalizedStatus === 'FOLLOW_UP' ? '#FF8A1F' : normalizedStatus === 'NOT_INTERESTED' ? '#FF3F4F' : '#4D32F4';
  return {
    ...item,
    color,
    title,
    date: formatTimelineDate(item.created_at || item.createdAt || item.updated_at || item.updatedAt || item.timestamp || item.date),
    author,
  };
};

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
        {!!author && <Text style={styles.eventAuthor}>By {author}</Text>}
      </View>
    </View>
  );
}

function LeadHistoryScreen({lead, status, onBack, onSessionExpired}) {
  const [history, setHistory] = useState([]);
  const statusColor = status === 'Interested' ? '#20B967' : status === 'Follow-up' ? '#FF781F' : '#FF3F4F';
  const statusBackground = status === 'Interested' ? '#DDF9E8' : status === 'Follow-up' ? '#FFF0E8' : '#FFECEF';

  useEffect(() => {
    if (!lead.id) {
      Alert.alert('Unable to load history', 'The selected lead does not have a valid ID.');
      return undefined;
    }
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const [timelineResult, detailsResult] = await Promise.allSettled([
          leadService.getAcquisitionTimeline(lead.id),
          leadService.getLeadDetails(lead.id),
        ]);
        if (timelineResult.status === 'rejected') {
          throw timelineResult.reason;
        }
        if (isMounted) {
          const items = extractTimeline(timelineResult.value).map(normalizeTimelineItem);
          const detailsResponse = detailsResult.status === 'fulfilled' ? detailsResult.value : null;
          const container = detailsResponse?.data || detailsResponse;
          const record = container?.lead || container;
          const followUp = record?.follow_up;
          // The timeline endpoint can retain the original schedule after a reschedule.
          // Use the current persisted schedule only for the latest scheduled entry.
          if (record?.status === 'FOLLOW_UP' && followUp?.follow_up_date && followUp?.follow_up_time) {
            const latestScheduledIndex = items.reduce((latest, item, index) =>
              /follow[ _-]?up scheduled/i.test(item.title) ? index : latest, -1);
            if (latestScheduledIndex >= 0) {
              items[latestScheduledIndex] = {
                ...items[latestScheduledIndex],
                title: `Follow-up Scheduled for ${String(followUp.follow_up_date).split('T')[0]} ${followUp.follow_up_time}`,
              };
            }
          }
          setHistory(items);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        if (error?.status === 401) {
          Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
          return;
        }
        Alert.alert('Unable to load history', error?.message || 'Please try again.');
      }
    };
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [lead.id, onSessionExpired]);

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
            <View style={styles.leadSummaryRow}>
              <View style={styles.leadSummaryText}>
                <Text style={styles.leadName}>{lead.name}</Text>
                <Text style={styles.leadLocation}>{lead.location}</Text>
              </View>
              <View style={[styles.statusBadge, {backgroundColor: statusBackground}]}><Text style={[styles.statusText, {color: statusColor}]}>{status}</Text></View>
            </View>
            <Text style={styles.leadId}>Lead ID: {lead.id}</Text>
          </View>
        </View>

        <Text style={styles.timelineHeading}>Timeline</Text>
        <View style={styles.timelineList}>
          {history.map((item, index) => <TimelineItem key={item.id || `${item.title}-${item.date}-${index}`} {...item} isLast={index === history.length - 1} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  leadSummaryRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  leadSummaryText: {flex: 1, minWidth: 0},
  screen: {flex: 1, backgroundColor: '#F8F9FC'},
  header: {height: 58, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12}, backButton: {width: 34, height: 40, justifyContent: 'center'}, backArrow: {width: 20, height: 16, justifyContent: 'center'}, arrowLine: {width: 19, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF'}, arrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '-45deg'}]}, arrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]}, headerTitle: {color: '#FFFFFF', fontSize: 17, fontFamily: 'Poppins_600SemiBold'},
  content: {paddingHorizontal: 15, paddingTop: 14, paddingBottom: 28}, leadCard: {minHeight: 92, marginHorizontal: -7, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E3E7F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, shadowColor: '#25315C', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2}, iconTile: {width: 48, height: 48, borderRadius: 10, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center'}, shopIcon: {width: 36, height: 36, tintColor: '#452EE5'}, leadText: {flex: 1, marginLeft: 11}, leadName: {color: '#121A40', fontSize: 15, fontWeight: '600'}, leadLocation: {color: '#5F6884', fontSize: 12, marginTop: 4}, leadId: {color: '#3C4668', fontSize: 11, lineHeight: 16, marginTop: 5}, statusBadge: {borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6}, statusText: {fontSize: 11, fontWeight: '500'},
  timelineHeading: {color: '#1C254D', fontSize: 15, fontWeight: '600', marginTop: 24, marginBottom: 17}, timelineList: {paddingHorizontal: 10}, timelineItem: {minHeight: 96, flexDirection: 'row'}, timelineRail: {width: 35, alignItems: 'center'}, timelineDot: {width: 20, height: 20, borderRadius: 10, borderWidth: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'}, timelineDotCenter: {width: 5, height: 5, borderRadius: 3}, timelineLine: {width: 2, flex: 1, backgroundColor: '#BCC3D8'}, timelineContent: {flex: 1, paddingLeft: 7, paddingBottom: 23}, eventTitle: {color: '#172047', fontSize: 14, fontWeight: '600'}, eventDate: {color: '#374160', fontSize: 12.5, fontWeight: '500', marginTop: 7}, eventAuthor: {color: '#68718C', fontSize: 12, marginTop: 6},
});

export default LeadHistoryScreen;
