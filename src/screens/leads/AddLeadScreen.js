import React, {useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
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

const salonIcon = require('../../assets/icons/add-salon-outline.png');
const contactIcon = require('../../assets/icons/add-contact-outline.png');
const phoneIcon = require('../../assets/icons/add-phone-outline.png');
const whatsappIcon = require('../../assets/icons/add-whatsapp-outline.png');

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

function AddLeadScreen({onBack}) {
  const [salonName, setSalonName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const onlyNumbers = setter => value => setter(value.replace(/\D/g, '').slice(0, 10));

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Back" hitSlop={12} onPress={onBack} style={styles.backButton}>
              <View style={styles.backArrow}><View style={styles.arrowLine} /><View style={styles.arrowTop} /><View style={styles.arrowBottom} /></View>
            </Pressable>
            <Text style={styles.title}>Add Lead</Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
            <FieldLabel required>Salon Name</FieldLabel>
            <InputField icon={salonIcon} onChangeText={setSalonName} placeholder="Enter salon name" value={salonName} />

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

            <View style={styles.flexSpace} />
            <Pressable style={({pressed}) => [styles.saveButton, pressed && styles.savePressed]}><Text style={styles.saveText}>Save Lead</Text></Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F3F4F7', justifyContent: 'flex-start'},
  sheet: {height: '76%', marginHorizontal: 7, marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E1E5EE', shadowColor: '#243052', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.13, shadowRadius: 10, elevation: 5},
  header: {height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14},
  backButton: {width: 28, height: 32, justifyContent: 'center'}, backArrow: {width: 18, height: 16, justifyContent: 'center'}, arrowLine: {width: 17, height: 2, borderRadius: 1, backgroundColor: '#10183C'}, arrowTop: {position: 'absolute', left: 0, top: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#10183C', transform: [{rotate: '-45deg'}]}, arrowBottom: {position: 'absolute', left: 0, bottom: 3, width: 9, height: 2, borderRadius: 1, backgroundColor: '#10183C', transform: [{rotate: '45deg'}]},
  title: {color: '#10183C', fontSize: 16, fontWeight: '400', marginLeft: 2},
  form: {flexGrow: 1, paddingHorizontal: 10, paddingBottom: 7},
  label: {color: '#172044', fontSize: 11, fontWeight: '400', marginTop: 8, marginBottom: 5}, required: {color: '#FF3F4F'},
  inputBox: {height: 44, borderWidth: 1.3, borderColor: '#596BFF', borderRadius: 9, backgroundColor: '#FDFDFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#4050C8', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1}, inputIconWrap: {width: 39, height: '100%', alignItems: 'center', justifyContent: 'center'}, inputIconImage: {width: 25, height: 25}, input: {flex: 1, height: '100%', color: '#11183A', fontSize: 11.5, paddingHorizontal: 5, paddingVertical: 0},
  phoneRow: {flexDirection: 'row', gap: 8}, countryCode: {width: 76, height: 44, borderWidth: 1.3, borderColor: '#596BFF', borderRadius: 9, backgroundColor: '#FDFDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, shadowColor: '#4050C8', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1}, countryText: {color: '#172044', fontSize: 12, fontWeight: '400'}, down: {width: 15, height: 10, position: 'relative'}, downLeft: {position: 'absolute', left: 0, top: 2, width: 10, height: 3, borderRadius: 2, backgroundColor: '#6D7693', transform: [{rotate: '45deg'}]}, downRight: {position: 'absolute', right: 0, top: 2, width: 10, height: 3, borderRadius: 2, backgroundColor: '#6D7693', transform: [{rotate: '-45deg'}]}, phoneInput: {flex: 1}, whatsappIconImage: {width: 25, height: 25},
  helper: {color: '#505A78', fontSize: 10, marginTop: 5}, flexSpace: {flex: 1, minHeight: 45},
  saveButton: {height: 46, marginHorizontal: -3, borderRadius: 9, borderWidth: 1.2, borderColor: '#17245A', backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center', shadowColor: '#07113D', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.18, shadowRadius: 6, elevation: 4}, savePressed: {opacity: 0.9}, saveText: {color: '#FFFFFF', fontSize: 13, fontWeight: '400'},
});

export default AddLeadScreen;
