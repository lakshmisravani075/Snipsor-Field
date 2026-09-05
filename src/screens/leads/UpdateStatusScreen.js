import React, {useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import {leadService} from '../../services/apiService.js';

const interestedIcon = require('../../assets/icons/status-interested.png');
const notInterestedIcon = require('../../assets/icons/status-not-interested.png');
const followUpIcon = require('../../assets/icons/status-follow-up.png');
const calendarIcon = require('../../assets/icons/detail-notes.png');

const STATUS_OPTIONS = [
  {title: 'Interested', subtitle: 'Salon is interested in joining Snipsor', icon: interestedIcon},
  {title: 'Not Interested', subtitle: 'Salon is not interested right now', icon: notInterestedIcon},
  {title: 'Follow-up', subtitle: 'We will follow up later', icon: followUpIcon},
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIME_OPTIONS = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM'];

const formatDate = date => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

const toIsoDate = value => {
  const trimmedValue = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return trimmedValue;
  }
  const match = trimmedValue.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (!match) {
    return null;
  }
  const monthIndex = MONTHS.findIndex(month => month.toLowerCase() === match[2].toLowerCase());
  if (monthIndex < 0) {
    return null;
  }
  const date = new Date(Number(match[3]), monthIndex, Number(match[1]));
  if (date.getFullYear() !== Number(match[3]) || date.getMonth() !== monthIndex || date.getDate() !== Number(match[1])) {
    return null;
  }
  return `${match[3]}-${String(monthIndex + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
};

const toApiTime = value => {
  const trimmedValue = String(value || '').trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmedValue)) {
    return trimmedValue;
  }
  const match = trimmedValue.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
    return null;
  }
  const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

const formatFollowUpTime = value => {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) {
    return value || '04:00 PM';
  }
  const hour = Number(match[1]);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
};

function UpdateStatusScreen({leadId, currentStatus, followup, followupTime, onBack, onSave, onSessionExpired}) {
  const today = new Date();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus || 'Interested');
  const [followUpDate, setFollowUpDate] = useState(followup || formatDate(today));
  const [followUpTime, setFollowUpTime] = useState(() => formatFollowUpTime(followupTime));
  const [note, setNote] = useState('');
  const [pickerMode, setPickerMode] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const current = STATUS_OPTIONS.find(option => option.title === currentStatus) || STATUS_OPTIONS[0];
  const calendarMonthName = MONTHS[calendarMonth.getMonth()];
  const calendarYear = calendarMonth.getFullYear();
  const daysInCalendarMonth = new Date(calendarYear, calendarMonth.getMonth() + 1, 0).getDate();

  const changeMonth = offset => {
    setCalendarMonth(previous => new Date(previous.getFullYear(), previous.getMonth() + offset, 1));
  };

  const updateStatus = async () => {
    if (isSaving) {
      return;
    }
    if (!leadId) {
      Alert.alert('Unable to update status', 'The selected lead does not have a valid ID.');
      return;
    }
    const payload = {
      status: selectedStatus.toUpperCase().replace(/[ -]+/g, '_'),
    };
    if (selectedStatus === 'Follow-up') {
      const apiDate = toIsoDate(followUpDate);
      const apiTime = toApiTime(followUpTime);
      if (!apiDate || !apiTime) {
        Alert.alert('Invalid follow-up details', 'Select a valid follow-up date and time.');
        return;
      }
      payload.follow_up_date = apiDate;
      payload.follow_up_time = apiTime;
      payload.follow_up_note = note.trim() || null;
    }
    try {
      setIsSaving(true);
      const response = await leadService.updateAcquisitionStatus(leadId, payload);
      onSave?.(selectedStatus, response, payload);
    } catch (error) {
      if (error?.status === 401) {
        Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
        return;
      }
      Alert.alert('Unable to update status', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to lead details" hitSlop={12} onPress={onBack} style={styles.backButton}>
          <View style={styles.backArrow}>
            <View style={styles.backArrowLine} />
            <View style={styles.backArrowTop} />
            <View style={styles.backArrowBottom} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Update Status</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Current Status</Text>
          <View style={styles.currentStatusCard}>
            <Image source={current.icon} resizeMode="contain" style={styles.currentIcon} />
            <View style={styles.optionText}>
              <Text style={styles.currentTitle}>{current.title}</Text>
              <Text style={styles.currentSubtitle}>Current salon status</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Change Status <Text style={styles.required}>*</Text></Text>
          {STATUS_OPTIONS.map(option => {
            const selected = selectedStatus === option.title;
            return (
              <Pressable key={option.title} onPress={() => setSelectedStatus(option.title)} style={[styles.optionCard, selected && styles.optionSelected]}>
                <Image source={option.icon} resizeMode="contain" style={styles.optionIcon} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, selected && styles.selectedText]}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
              </Pressable>
            );
          })}

          {selectedStatus === 'Follow-up' && (
            <View style={styles.followUpSection}>
              <Text style={styles.followUpHeading}>Follow-up Details</Text>
              <Text style={styles.fieldLabel}>Follow-up Date <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputValue}>{followUpDate}</Text>
                <Pressable accessibilityLabel="Select follow-up date" hitSlop={10} onPress={() => setPickerMode('date')}><Image source={calendarIcon} resizeMode="contain" style={styles.fieldIcon} /></Pressable>
              </View>
              <Text style={styles.fieldLabel}>Follow-up Time <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputValue}>{followUpTime}</Text>
                <Pressable accessibilityLabel="Select follow-up time" hitSlop={10} onPress={() => setPickerMode('time')}><Image source={followUpIcon} resizeMode="contain" style={styles.fieldIcon} /></Pressable>
              </View>
              <Text style={styles.fieldLabel}>Note (Optional)</Text>
              <View style={styles.noteBox}>
                <TextInput multiline maxLength={300} value={note} onChangeText={setNote} placeholder="Enter follow-up notes" placeholderTextColor="#737B94" style={styles.noteInput} textAlignVertical="top" />
                <Text style={styles.counter}>{note.length}/300</Text>
              </View>
            </View>
          )}

          <Pressable disabled={isSaving} onPress={updateStatus} style={({pressed}) => [styles.updateButton, isSaving && styles.updateButtonDisabled, pressed && styles.pressed]}>
            <Text style={styles.updateButtonText}>{isSaving ? 'Updating Status...' : 'Update Status'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent animationType="fade" visible={pickerMode !== null} onRequestClose={() => setPickerMode(null)}>
        <Pressable onPress={() => setPickerMode(null)} style={styles.modalBackdrop}>
          <Pressable onPress={() => {}} style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{pickerMode === 'date' ? 'Select Follow-up Date' : 'Select Follow-up Time'}</Text>
            {pickerMode === 'date' ? (
              <>
                <View style={styles.monthNavigation}>
                  <Pressable accessibilityLabel="Previous month" hitSlop={10} onPress={() => changeMonth(-1)} style={styles.monthArrowButton}><Text style={styles.monthArrow}>‹</Text></Pressable>
                  <Text style={styles.monthTitle}>{calendarMonthName} {calendarYear}</Text>
                  <Pressable accessibilityLabel="Next month" hitSlop={10} onPress={() => changeMonth(1)} style={styles.monthArrowButton}><Text style={styles.monthArrow}>›</Text></Pressable>
                </View>
                <View style={styles.daysGrid}>
                  {Array.from({length: daysInCalendarMonth}, (_, index) => index + 1).map(day => (
                    <Pressable key={day} onPress={() => { setFollowUpDate(`${day} ${calendarMonthName} ${calendarYear}`); setPickerMode(null); }} style={[styles.dayButton, followUpDate === `${day} ${calendarMonthName} ${calendarYear}` && styles.pickerSelected]}>
                      <Text style={[styles.dayText, followUpDate === `${day} ${calendarMonthName} ${calendarYear}` && styles.pickerSelectedText]}>{day}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <ScrollView style={styles.timeList}>
                {TIME_OPTIONS.map(time => (
                  <Pressable key={time} onPress={() => { setFollowUpTime(time); setPickerMode(null); }} style={[styles.timeButton, followUpTime === time && styles.pickerSelected]}>
                    <Text style={[styles.timeText, followUpTime === time && styles.pickerSelectedText]}>{time}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'}, keyboardView: {flex: 1},
  header: {height: 58, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10}, backButton: {width: 34, height: 40, justifyContent: 'center'}, backArrow: {width: 20, height: 16, justifyContent: 'center'}, backArrowLine: {width: 19, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF'}, backArrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '-45deg'}]}, backArrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]}, headerTitle: {color: '#FFFFFF', fontSize: 17, fontWeight: '500'},
  content: {paddingHorizontal: 14, paddingTop: 14, paddingBottom: 20}, sectionLabel: {color: '#242C53', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4}, required: {color: '#F04455'},
  currentStatusCard: {height: 64, borderRadius: 10, borderWidth: 1, borderColor: '#E1E5EF', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12}, currentIcon: {width: 29, height: 29}, currentTitle: {color: '#172047', fontSize: 14, fontWeight: '600'}, currentSubtitle: {color: '#68718C', fontSize: 11.5, marginTop: 4},
  optionCard: {minHeight: 64, borderRadius: 10, borderWidth: 1, borderColor: '#E1E5EF', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8}, optionSelected: {borderWidth: 1.5, borderColor: '#6955FA', backgroundColor: '#FAF9FF'}, optionIcon: {width: 28, height: 28}, optionText: {flex: 1, marginLeft: 12}, optionTitle: {color: '#172047', fontSize: 13.5, fontWeight: '600'}, selectedText: {color: '#3D2DCE'}, optionSubtitle: {color: '#68718C', fontSize: 10.5, marginTop: 4}, radio: {width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#929AB5', alignItems: 'center', justifyContent: 'center'}, radioSelected: {borderColor: '#5A3FF2'}, radioDot: {width: 11, height: 11, borderRadius: 6, backgroundColor: '#5A3FF2'},
  followUpSection: {marginTop: 7}, followUpHeading: {color: '#452EE5', fontSize: 13, fontWeight: '600', marginBottom: 10}, fieldLabel: {color: '#242C53', fontSize: 12.5, fontWeight: '500', marginBottom: 6}, inputBox: {height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#D8DDE9', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginBottom: 10}, inputValue: {flex: 1, color: '#172047', fontSize: 13}, fieldIcon: {width: 18, height: 18}, noteBox: {height: 91, borderRadius: 8, borderWidth: 1, borderColor: '#D8DDE9', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingTop: 8, marginBottom: 12}, noteInput: {flex: 1, color: '#172047', fontSize: 13, padding: 0}, counter: {alignSelf: 'flex-end', color: '#69718D', fontSize: 10.5, marginBottom: 6},
  updateButton: {height: 49, borderRadius: 8, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center', marginTop: 8}, updateButtonDisabled: {opacity: 0.65}, updateButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '500'}, pressed: {opacity: 0.85},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(7, 17, 61, 0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22}, pickerCard: {width: '100%', maxHeight: 480, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 18}, pickerTitle: {color: '#11183A', fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 14}, monthNavigation: {height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7}, monthArrowButton: {width: 40, height: 36, alignItems: 'center', justifyContent: 'center'}, monthArrow: {color: '#3525B8', fontSize: 30, lineHeight: 31}, monthTitle: {color: '#3525B8', fontSize: 14, fontWeight: '600', textAlign: 'center'}, daysGrid: {flexDirection: 'row', flexWrap: 'wrap'}, dayButton: {width: '14.28%', height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'}, dayText: {color: '#263052', fontSize: 13}, pickerSelected: {backgroundColor: '#4D32F4'}, pickerSelectedText: {color: '#FFFFFF', fontWeight: '600'}, timeList: {maxHeight: 350}, timeButton: {height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 5}, timeText: {color: '#263052', fontSize: 14},
});

export default UpdateStatusScreen;
