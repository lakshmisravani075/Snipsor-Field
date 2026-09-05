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

const personIcon = require('../../assets/icons/add-contact-outline.png');
const EXECUTIVES = ['Priya Sharma', 'Ananya Rao', 'Kiran Kumar'];

function BackArrow() {
  return <View style={styles.backArrow}><View style={styles.arrowLine} /><View style={styles.arrowTop} /><View style={styles.arrowBottom} /></View>;
}

function DownArrow() {
  return <View style={styles.down}><View style={styles.downLeft} /><View style={styles.downRight} /></View>;
}

function HandoffScreen({lead, onBack}) {
  const [executive, setExecutive] = useState('Priya Sharma');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState('Owner is interested and ready for onboarding.\nPlease contact and proceed.');

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back to lead details" hitSlop={12} onPress={onBack} style={styles.backButton}><BackArrow /></Pressable>
          <View><Text style={styles.title}>Handoff to Onboarding</Text><Text style={styles.salon}>{lead.name}</Text></View>
        </View>

        <View style={styles.transferRow}>
          <View style={[styles.personCircle, styles.fromCircle]}><Image source={personIcon} resizeMode="contain" style={styles.personImage} /></View>
          <View style={styles.transferLine}><View style={styles.dash} /><View style={styles.dash} /><View style={styles.dash} /><View style={styles.dash} /><Text style={styles.transferArrow}>→</Text></View>
          <View style={[styles.personCircle, styles.toCircle]}><Image source={personIcon} resizeMode="contain" style={styles.personImage} /></View>
        </View>

        <Text style={styles.message}>You are about to handoff this lead to</Text>
        <Text style={styles.team}>Onboarding Team</Text>

        <Text style={styles.label}>Onboarding Executive <Text style={styles.required}>*</Text></Text>
        <Pressable onPress={() => setIsDropdownOpen(value => !value)} style={styles.select}><Text style={styles.selectText}>{executive}</Text><DownArrow /></Pressable>
        {isDropdownOpen && (
          <View style={styles.dropdown}>
            {EXECUTIVES.map(item => <Pressable key={item} onPress={() => {setExecutive(item); setIsDropdownOpen(false);}} style={styles.option}><Text style={[styles.optionText, item === executive && styles.optionActive]}>{item}</Text></Pressable>)}
          </View>
        )}

        <Text style={styles.notesLabel}>Handoff Notes</Text>
        <View style={styles.notesBox}>
          <TextInput maxLength={300} multiline onChangeText={setNotes} style={styles.notesInput} textAlignVertical="top" value={notes} />
          <Text style={styles.counter}>{notes.length}/300</Text>
        </View>

        <View style={styles.flexSpace} />
        <Pressable style={({pressed}) => [styles.handoffButton, pressed && styles.pressed]}><Text style={styles.handoffText}>Handoff Lead</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC', paddingHorizontal: 7, paddingVertical: 4},
  card: {flex: 1, backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1, borderColor: '#E2E6F0', paddingHorizontal: 18, shadowColor: '#28345C', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 9, elevation: 4},
  header: {height: 77, flexDirection: 'row', alignItems: 'center'}, backButton: {width: 40, height: 42, justifyContent: 'center'}, backArrow: {width: 21, height: 17, justifyContent: 'center'}, arrowLine: {width: 20, height: 2.3, borderRadius: 2, backgroundColor: '#10183D'}, arrowTop: {position: 'absolute', left: 0, top: 3, width: 10, height: 2.3, borderRadius: 2, backgroundColor: '#10183D', transform: [{rotate: '-45deg'}]}, arrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 10, height: 2.3, borderRadius: 2, backgroundColor: '#10183D', transform: [{rotate: '45deg'}]},
  title: {color: '#10183D', fontSize: 19, fontFamily: 'Poppins_600SemiBold'}, salon: {color: '#263052', fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginTop: 5},
  transferRow: {height: 77, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}, personCircle: {width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.18, shadowRadius: 5, elevation: 4}, fromCircle: {backgroundColor: '#4D20EC', shadowColor: '#4D20EC'}, toCircle: {backgroundColor: '#098CF5', shadowColor: '#098CF5'}, personImage: {width: 32, height: 32, tintColor: '#FFFFFF'},
  transferLine: {width: 83, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5}, dash: {width: 10, height: 1.5, backgroundColor: '#654AFF'}, transferArrow: {color: '#654AFF', fontSize: 20, marginLeft: -5},
  message: {color: '#334066', fontSize: 13, textAlign: 'center', marginTop: 9}, team: {color: '#4D18F2', fontSize: 18, fontWeight: '400', textAlign: 'center', marginTop: 7},
  label: {color: '#141C40', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 30, marginBottom: 8}, required: {color: '#F23F51'},
  select: {height: 43, borderWidth: 1, borderColor: '#A4AEFF', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#FFFFFF'}, selectText: {flex: 1, color: '#11183C', fontSize: 12, fontWeight: '400'},
  down: {width: 13, height: 9, position: 'relative'}, downLeft: {position: 'absolute', left: 0, top: 2, width: 9, height: 2, borderRadius: 1, backgroundColor: '#59627E', transform: [{rotate: '45deg'}]}, downRight: {position: 'absolute', right: 0, top: 2, width: 9, height: 2, borderRadius: 1, backgroundColor: '#59627E', transform: [{rotate: '-45deg'}]},
  dropdown: {position: 'absolute', top: 335, left: 18, right: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6DAE8', borderRadius: 8, paddingVertical: 4, zIndex: 10, elevation: 10, shadowColor: '#1B2853', shadowOpacity: 0.15, shadowRadius: 7}, option: {height: 35, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F0F1F5'}, optionText: {color: '#555E7A', fontSize: 12}, optionActive: {color: '#4D32F4', fontWeight: '400'},
  notesLabel: {color: '#141C40', fontSize: 12, fontWeight: '400', marginTop: 21, marginBottom: 8}, notesBox: {height: 105, borderWidth: 1, borderColor: '#A4AEFF', borderRadius: 8, position: 'relative'}, notesInput: {flex: 1, color: '#152044', fontSize: 12, lineHeight: 18, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 23}, counter: {position: 'absolute', right: 9, bottom: 7, color: '#3B4580', fontSize: 10},
  flexSpace: {flex: 1, minHeight: 25}, handoffButton: {height: 49, borderRadius: 8, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#07113D', shadowOpacity: 0.18, shadowRadius: 5, elevation: 3}, pressed: {opacity: 0.9}, handoffText: {color: '#FFFFFF', fontSize: 16, fontWeight: '400'},
});

export default HandoffScreen;
