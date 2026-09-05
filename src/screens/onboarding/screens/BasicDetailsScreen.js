import React, {useMemo, useState} from 'react';
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

const shopIcon = require('../../../assets/icons/detail-shop.png');
const phoneIcon = require('../../../assets/icons/detail-phone.png');
const contactIcon = require('../../../assets/icons/detail-contact.png');
const gstDocumentIcon = require('../../../assets/icons/onboarding-gst-document.png');
const unisexIcon = require('../../../assets/icons/onboarding-unisex.png');

const SALON_TYPES = ['Men', 'Women', 'Unisex'];

function Toggle({value, onChange}) {
  return <Pressable accessibilityRole="switch" accessibilityState={{checked: value}} onPress={() => onChange(!value)} style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleThumb, value && styles.toggleThumbOn]} /></Pressable>;
}

function FieldIcon({source, large = false}) {
  return <View style={styles.fieldIconWrap}><Image source={source} resizeMode="contain" style={[styles.fieldIcon, large ? styles.fieldIconLarge : styles.fieldIconDefault]} /></View>;
}

function ChevronIcon({large = false}) {
  return <View style={[styles.chevronShape, large && styles.chevronShapeLarge]}><View style={[styles.chevronStroke, styles.chevronLeft, large && styles.chevronStrokeLarge]} /><View style={[styles.chevronStroke, styles.chevronRight, large && styles.chevronStrokeLarge]} /></View>;
}

function UnisexFieldIcon() {
  return <View style={styles.fieldIconWrap}><Image source={unisexIcon} resizeMode="contain" style={styles.unisexImage} /></View>;
}

function BasicDetailsScreen({salon, initialValues, onBack, onSave}) {
  const [salonName, setSalonName] = useState(initialValues?.salonName || '');
  const [mobileNumber, setMobileNumber] = useState(initialValues?.mobileNumber || '');
  const [salonType, setSalonType] = useState(initialValues?.salonType || '');
  const [showTypes, setShowTypes] = useState(false);
  const [gstRegistered, setGstRegistered] = useState(initialValues?.gstRegistered || false);
  const [priceExclusive, setPriceExclusive] = useState(initialValues?.priceExclusive || false);
  const [gstNumber, setGstNumber] = useState(initialValues?.gstNumber || '');
  const isValid = useMemo(() => salonName.trim().length > 1 && mobileNumber.length === 10 && Boolean(salonType) && (!gstRegistered || gstNumber.trim().length >= 15), [gstNumber, gstRegistered, mobileNumber, salonName, salonType]);

  const save = () => {
    if (isValid) onSave({salonName: salonName.trim(), mobileNumber, salonType, gstRegistered, priceExclusive, gstNumber: gstNumber.trim()});
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" hitSlop={12} onPress={onBack} style={styles.backButton}><Text style={styles.backArrow}>←</Text></Pressable>
          <Text style={styles.headerTitle}>Basic Details</Text>
        </View>
        <View style={styles.progressArea}><Text style={styles.stepText}>Step 1 of 8</Text><View style={styles.progressImageWrap}><View style={styles.progressFill}><View style={styles.progressHighlight} /></View></View></View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Tell us about the salon</Text>

            <Text style={styles.label}>Salon Name <Text style={styles.required}>*</Text></Text>
            <View style={[styles.inputBox, salonName && styles.inputBoxActive]}><FieldIcon source={shopIcon} /><TextInput value={salonName} onChangeText={value => setSalonName(value.slice(0, 50))} placeholder="Enter salon name" placeholderTextColor="#9A9FB2" style={styles.input} /><Text style={styles.counter}>{salonName.length}/50</Text></View>
            <Text style={styles.helper}>Enter the name of your salon as it appears to customers.</Text>

            <Text style={styles.label}>Mobile Number <Text style={styles.required}>*</Text></Text>
            <View style={[styles.inputBox, mobileNumber.length === 10 && styles.inputBoxActive]}><FieldIcon source={phoneIcon} /><View style={styles.countryCode}><Text style={styles.countryText}>+91</Text><ChevronIcon /></View><TextInput value={mobileNumber} onChangeText={value => setMobileNumber(value.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="Enter mobile number" placeholderTextColor="#9A9FB2" style={styles.input} /></View>
            <Text style={styles.helper}>This number will be used for all communications.</Text>

            <Text style={styles.label}>Salon Type <Text style={styles.required}>*</Text></Text>
            <Pressable onPress={() => setShowTypes(value => !value)} style={[styles.inputBox, showTypes && styles.inputBoxFocused]}>{salonType === 'Unisex' ? <UnisexFieldIcon /> : <FieldIcon source={contactIcon} />}<Text style={[styles.selectText, !salonType && styles.placeholder]}>{salonType || 'Select salon type'}</Text><View style={styles.salonChevron}><ChevronIcon large /></View></Pressable>
            {showTypes && <View style={styles.options}>{SALON_TYPES.map(type => <Pressable key={type} onPress={() => { setSalonType(type); setShowTypes(false); }} style={styles.option}>{type === 'Unisex' ? <UnisexFieldIcon /> : <FieldIcon source={contactIcon} />}<Text style={styles.optionText}>{type}</Text>{salonType === type && <Text style={styles.selectedCheck}>✓</Text>}</Pressable>)}</View>}

            <View style={styles.toggleRow}><Text style={styles.toggleLabel}>GST Number Registered?</Text><Toggle value={gstRegistered} onChange={setGstRegistered} /></View>
            {gstRegistered && <View style={styles.gstPanel}>
              <View style={styles.toggleRow}><View style={styles.priceCopy}><View style={styles.priceTitleRow}><Text style={styles.gstTitle}>•  Price exclusive of tax</Text>{priceExclusive && <View style={styles.recommendedPill}><Text style={styles.recommendedText}>Recommended</Text></View>}</View><Text style={styles.gstHelper}>All displayed prices will be shown excluding GST.</Text></View><Toggle value={priceExclusive} onChange={setPriceExclusive} /></View>
              <View style={styles.divider} />
              <Text style={styles.gstTitle}>•  GST Number <Text style={styles.required}>*</Text></Text><Text style={styles.gstHelper}>Enter your 15-digit GST number.</Text>
              <View style={styles.inputBox}><FieldIcon source={gstDocumentIcon} large /><TextInput autoCapitalize="characters" value={gstNumber} onChangeText={value => setGstNumber(value.replace(/\s/g, '').slice(0, 15).toUpperCase())} placeholder="GSTIN" placeholderTextColor="#9A9FB2" style={styles.input} />{gstNumber.length === 15 && <View style={styles.validCircle}><View style={styles.validTick} /></View>}</View>
            </View>}
          </View>
        </ScrollView>

        <View style={styles.footer}><Pressable onPress={onBack} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!isValid} onPress={save} style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}><Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>Save & Continue</Text></Pressable></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 57, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14},
  backButton: {width: 30, height: 40, justifyContent: 'center', marginRight: 9}, backArrow: {color: '#FFFFFF', fontSize: 19, lineHeight: 24},
  headerTitle: {flex: 1, color: '#FFFFFF', fontSize: 18, fontFamily: 'Poppins_600SemiBold'},
  progressArea: {height: 52, backgroundColor: '#07113D', paddingHorizontal: 4}, stepText: {color: '#FFFFFF', fontSize: 11, fontWeight: '500', marginLeft: 10},
  progressImageWrap: {width: '100%', height: 9, borderRadius: 99, backgroundColor: '#66779B', marginTop: 8, overflow: 'hidden'}, progressFill: {width: '12.5%', height: '100%', borderRadius: 99, backgroundColor: '#84AFF3', overflow: 'hidden'}, progressHighlight: {width: '100%', height: '100%', borderRadius: 99, backgroundColor: '#9FC1F5', opacity: 0.72},
  scrollContent: {paddingHorizontal: 8, paddingTop: 10, paddingBottom: 18},
  formCard: {minHeight: 510, backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1.2, borderTopColor: '#E2E6F0', paddingHorizontal: 14, paddingTop: 17, paddingBottom: 24, overflow: 'hidden'},
  formTitle: {color: '#111735', fontSize: 15, fontWeight: '600', marginBottom: 18},
  label: {color: '#202744', fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 7, marginTop: 2}, required: {color: '#F04452'},
  inputBox: {height: 47, borderWidth: 1, borderColor: '#DDE1EB', borderRadius: 7, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center'},
  inputBoxActive: {borderColor: '#A9B9E8'}, inputBoxFocused: {borderColor: '#426DF5', borderWidth: 1.3},
  fieldIconWrap: {width: 42, height: '100%', borderRightWidth: 1, borderRightColor: '#E7E9F0', alignItems: 'center', justifyContent: 'center'}, fieldIcon: {tintColor: '#183673'}, fieldIconDefault: {width: 21, height: 21}, fieldIconLarge: {width: 28, height: 28},
  unisexImage: {width: 21, height: 21, tintColor: '#183673'},
  input: {flex: 1, color: '#111735', fontSize: 11, paddingHorizontal: 10, paddingVertical: 0, fontFamily: 'Inter_400Regular'}, counter: {color: '#8A90A5', fontSize: 8, marginRight: 8, fontFamily: 'Inter_400Regular'},
  helper: {color: '#858BA0', fontSize: 8, marginTop: 5, marginBottom: 18},
  countryCode: {height: 27, borderRightWidth: 1, borderRightColor: '#E5E7EF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center'}, countryText: {color: '#1C254C', fontSize: 11, marginRight: 8},
  chevronShape: {width: 11, height: 7, position: 'relative'}, chevronShapeLarge: {width: 17, height: 11},
  chevronStroke: {position: 'absolute', top: 2, width: 7, height: 2, borderRadius: 1, backgroundColor: '#26365E'}, chevronStrokeLarge: {top: 3, width: 11, height: 2.5},
  chevronLeft: {left: 0, transform: [{rotate: '42deg'}]}, chevronRight: {right: 0, transform: [{rotate: '-42deg'}]},
  salonChevron: {width: 42, height: '100%', alignItems: 'center', justifyContent: 'center'},
  selectText: {flex: 1, color: '#111735', fontSize: 11, paddingHorizontal: 10}, placeholder: {color: '#9A9FB2'},
  options: {borderWidth: 1, borderTopWidth: 0, borderColor: '#DDE1EB', borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: '#FFFFFF', overflow: 'hidden'},
  option: {height: 44, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F1F5'}, optionText: {color: '#28304F', fontSize: 11, marginLeft: 10}, selectedCheck: {color: '#3268E9', fontSize: 15, marginLeft: 'auto', marginRight: 13},
  toggleRow: {minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8}, toggleLabel: {color: '#242B49', fontSize: 11, fontWeight: '600'},
  toggle: {width: 39, height: 22, borderRadius: 11, backgroundColor: '#D0D3DA', padding: 2}, toggleOn: {backgroundColor: '#2164C4'}, toggleThumb: {width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF'}, toggleThumbOn: {alignSelf: 'flex-end'},
  gstPanel: {borderWidth: 1, borderColor: '#E0E3EB', borderRadius: 7, paddingHorizontal: 11, paddingBottom: 11}, priceCopy: {flex: 1, paddingRight: 8}, priceTitleRow: {flexDirection: 'row', alignItems: 'center'}, gstTitle: {color: '#293150', fontSize: 10.5, fontWeight: '600'}, recommendedPill: {height: 18, borderRadius: 9, backgroundColor: '#E9F0FF', justifyContent: 'center', paddingHorizontal: 7, marginLeft: 8}, recommendedText: {color: '#4571CF', fontSize: 7.5, fontWeight: '600'}, gstHelper: {color: '#858BA0', fontSize: 8, marginTop: 5, marginBottom: 9, marginLeft: 8}, divider: {height: 1, backgroundColor: '#E8EAF0', marginVertical: 10}, validCircle: {width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: '#25B968', alignItems: 'center', justifyContent: 'center', marginRight: 9}, validTick: {width: 9, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#25B968', transform: [{rotate: '-45deg'}, {translateY: -1}]},
  footer: {height: 70, borderTopWidth: 1, borderTopColor: '#E4E7EF', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingTop: 9, flexDirection: 'row', gap: 10},
  cancelButton: {flex: 1, height: 45, borderWidth: 1, borderColor: '#3568E8', borderRadius: 7, alignItems: 'center', justifyContent: 'center'}, cancelText: {color: '#174199', fontSize: 11, fontWeight: '600'},
  saveButton: {flex: 1.2, height: 45, borderRadius: 7, backgroundColor: '#07113D', alignItems: 'center', justifyContent: 'center'}, saveButtonDisabled: {backgroundColor: '#EFF0F5'}, saveText: {color: '#FFFFFF', fontSize: 11, fontWeight: '600'}, saveTextDisabled: {color: '#C3C6D0'},
});

export default BasicDetailsScreen;
