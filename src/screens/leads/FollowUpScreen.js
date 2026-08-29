// @refresh reset
import React, {useState} from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const MODES = ['Call', 'Visit', 'WhatsApp', 'Other'];
const DATE_OPTIONS = ['28 Aug 2026', '29 Aug 2026', '30 Aug 2026', '31 Aug 2026'];
const TIME_OPTIONS = ['10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM'];
const calendarIcon = require('../../assets/icons/detail-notes.png');

function DownArrow() {
  return <View style={styles.down}><View style={styles.downLeft} /><View style={styles.downRight} /></View>;
}

function BackArrow() {
  return <View style={styles.backArrow}><View style={styles.arrowLine} /><View style={styles.arrowTop} /><View style={styles.arrowBottom} /></View>;
}

function FollowUpScreen({lead, onBack}) {
  const [mode, setMode] = useState('Call');
  const [notes, setNotes] = useState('Discussed Snipsor features and pricing.\nOwner is interested.\nWill share documents tomorrow.');
  const [selectedDate, setSelectedDate] = useState(lead.followup === 'Today' ? '28 Aug 2026' : lead.followup);
  const [selectedTime, setSelectedTime] = useState('11:00 AM');
  const [openDropdown, setOpenDropdown] = useState(null);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to lead details" hitSlop={12} onPress={onBack} style={styles.backButton}><BackArrow /></Pressable>
        <View style={styles.headerText}><Text style={styles.title}>Follow-up</Text><Text style={styles.salon}>{lead.name}</Text></View>
        <Pressable style={styles.saveButton}><Text style={styles.saveText}>Save</Text></Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Follow-up Details</Text>

        <View style={styles.fieldsRow}>
          <View style={[styles.dateColumn, openDropdown === 'date' && styles.openColumn]}>
            <Text style={styles.label}>Follow-up Date <Text style={styles.required}>*</Text></Text>
            <Pressable onPress={() => setOpenDropdown(value => value === 'date' ? null : 'date')} style={styles.field}><Image source={calendarIcon} resizeMode="contain" style={styles.calendarIcon} /><Text style={styles.fieldText}>{selectedDate}</Text><DownArrow /></Pressable>
            {openDropdown === 'date' && (
              <View style={styles.dropdownMenu}>
                {DATE_OPTIONS.map(item => <Pressable key={item} onPress={() => {setSelectedDate(item); setOpenDropdown(null);}} style={styles.dropdownOption}><Text style={[styles.dropdownText, item === selectedDate && styles.dropdownTextActive]}>{item}</Text></Pressable>)}
              </View>
            )}
          </View>
          <View style={[styles.timeColumn, openDropdown === 'time' && styles.openColumn]}>
            <Text style={styles.label}>Follow-up Time</Text>
            <Pressable onPress={() => setOpenDropdown(value => value === 'time' ? null : 'time')} style={styles.field}><View style={styles.clock}><View style={styles.clockHand} /></View><Text style={styles.fieldText}>{selectedTime}</Text><DownArrow /></Pressable>
            {openDropdown === 'time' && (
              <View style={styles.dropdownMenu}>
                {TIME_OPTIONS.map(item => <Pressable key={item} onPress={() => {setSelectedTime(item); setOpenDropdown(null);}} style={styles.dropdownOption}><Text style={[styles.dropdownText, item === selectedTime && styles.dropdownTextActive]}>{item}</Text></Pressable>)}
              </View>
            )}
          </View>
        </View>

        <Text style={styles.modeLabel}>Mode of Follow-up</Text>
        <View style={styles.modes}>
          {MODES.map(item => (
            <Pressable key={item} onPress={() => setMode(item)} style={[styles.mode, item === mode && styles.modeActive]}><Text style={[styles.modeText, item === mode && styles.modeTextActive]}>{item}</Text></Pressable>
          ))}
        </View>

        <Text style={styles.notesLabel}>Notes</Text>
        <View style={styles.notesBox}>
          <TextInput multiline maxLength={300} onChangeText={setNotes} style={styles.notesInput} textAlignVertical="top" value={notes} />
          <Text style={styles.counter}>{notes.length}/300</Text>
        </View>

        <View style={styles.spacer} />
        <Pressable style={({pressed}) => [styles.updateButton, pressed && styles.updatePressed]}><Text style={styles.updateText}>Update Follow-up</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 80, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#EEF0F5'},
  backButton: {width: 35, height: 40, justifyContent: 'center'}, backArrow: {width: 20, height: 17, justifyContent: 'center'}, arrowLine: {width: 19, height: 2.2, borderRadius: 2, backgroundColor: '#10183D'}, arrowTop: {position: 'absolute', left: 0, top: 3, width: 10, height: 2.2, borderRadius: 2, backgroundColor: '#10183D', transform: [{rotate: '-45deg'}]}, arrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 10, height: 2.2, borderRadius: 2, backgroundColor: '#10183D', transform: [{rotate: '45deg'}]},
  headerText: {flex: 1}, title: {color: '#11183C', fontSize: 20, fontWeight: '400'}, salon: {color: '#263052', fontSize: 13, fontWeight: '400', marginTop: 4}, saveButton: {height: 35, justifyContent: 'center', paddingHorizontal: 9}, saveText: {color: '#4D32F4', fontSize: 16, fontWeight: '400'},
  card: {flex: 1, marginTop: 8, backgroundColor: '#FFFFFF', borderTopLeftRadius: 15, borderTopRightRadius: 15, borderWidth: 1, borderBottomWidth: 0, borderColor: '#E6E8F0', paddingHorizontal: 18, paddingTop: 14},
  cardTitle: {color: '#11183C', fontSize: 16, fontWeight: '400'}, fieldsRow: {flexDirection: 'row', gap: 14, marginTop: 19, zIndex: 10}, dateColumn: {flex: 1.28, position: 'relative'}, timeColumn: {flex: 1, position: 'relative'}, openColumn: {zIndex: 20}, label: {color: '#171F43', fontSize: 13, fontWeight: '400', marginBottom: 7}, required: {color: '#F13F4E'},
  field: {height: 43, borderWidth: 1, borderColor: '#A4AEFF', borderRadius: 9, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, backgroundColor: '#FFFFFF'}, calendarIcon: {width: 18, height: 18, marginRight: 9, tintColor: '#344599'}, fieldText: {flex: 1, color: '#11183C', fontSize: 13, fontWeight: '400'},
  down: {width: 13, height: 9, position: 'relative'}, downLeft: {position: 'absolute', left: 0, top: 2, width: 9, height: 2, borderRadius: 1, backgroundColor: '#59627E', transform: [{rotate: '45deg'}]}, downRight: {position: 'absolute', right: 0, top: 2, width: 9, height: 2, borderRadius: 1, backgroundColor: '#59627E', transform: [{rotate: '-45deg'}]},
  clock: {width: 16, height: 16, borderRadius: 8, borderWidth: 1.7, borderColor: '#344599', marginRight: 9, alignItems: 'center', justifyContent: 'center'}, clockHand: {width: 1.5, height: 5, backgroundColor: '#344599', transform: [{translateY: -1}]},
  dropdownMenu: {position: 'absolute', top: 67, left: 0, right: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6DAE8', borderRadius: 9, paddingVertical: 4, shadowColor: '#1B2853', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.16, shadowRadius: 8, elevation: 10}, dropdownOption: {height: 34, justifyContent: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#F0F1F5'}, dropdownText: {color: '#4E5674', fontSize: 12, fontWeight: '400'}, dropdownTextActive: {color: '#4D32F4', fontWeight: '400'},
  modeLabel: {color: '#171F43', fontSize: 13, fontWeight: '400', marginTop: 20, marginBottom: 8}, modes: {height: 42, flexDirection: 'row', gap: 8}, mode: {flex: 1, borderWidth: 1, borderColor: '#D3D7EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'}, modeActive: {backgroundColor: '#07113D', borderColor: '#07113D', zIndex: 1}, modeText: {color: '#222A4B', fontSize: 12, fontWeight: '400'}, modeTextActive: {color: '#FFFFFF'},
  notesLabel: {color: '#171F43', fontSize: 13, fontWeight: '400', marginTop: 22, marginBottom: 8}, notesBox: {height: 118, borderWidth: 1, borderColor: '#A4AEFF', borderRadius: 9, backgroundColor: '#FFFFFF', position: 'relative'}, notesInput: {flex: 1, color: '#172044', fontSize: 13, lineHeight: 20, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24}, counter: {position: 'absolute', right: 10, bottom: 8, color: '#3A4380', fontSize: 11},
  spacer: {flex: 1, minHeight: 25}, updateButton: {height: 51, borderRadius: 8, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center', marginBottom: 17, shadowColor: '#07113D', shadowOpacity: 0.18, shadowRadius: 5, elevation: 3}, updatePressed: {opacity: 0.9}, updateText: {color: '#FFFFFF', fontSize: 17, fontWeight: '400'},
});

export default FollowUpScreen;
