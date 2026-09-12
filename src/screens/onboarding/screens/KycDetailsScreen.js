import React, {useEffect, useRef, useState} from 'react';
import {Alert, Image, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import {onboardingService} from '../../../services/apiService';
import {readAddress} from './AddressScreen';
const verifyShieldIcon = require('../../../assets/icons/kyc-verify-shield.png');
const successIcon = require('../../../assets/icons/onboarding-step-complete.png');

function LockIcon(){return <View style={s.lock}><View style={s.shackle}/><View style={s.lockBody}><View style={s.keyhole}/></View></View>;}
function Field({label,value,onChangeText,placeholder,keyboardType,maxLength}){return <View style={s.fieldWrap}><Text style={s.label}>{label} <Text style={s.required}>*</Text></Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA3B5" keyboardType={keyboardType} maxLength={maxLength} style={s.input}/></View>;}

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const readValue = (record, keys) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) { return String(record[key]); }
  }
  return '';
};
const readKycDetails = response => {
  const root = object(response?.data || response);
  const link = object(root.bank_account_link || root.bankAccountLink || root.bank_account || root.bank || root.kyc || root);
  const beneficiary = object(root.beneficiary || root.beneficiaries?.[0] || root.data?.beneficiary);
  const salon = object(root.salon_details || root.saloon_details || root.salon || root.saloon);
  const address = object(root.address || root.address_details || salon.address);
  const state = readValue(link, ['verification_status', 'verificationStatus', 'status']).toLowerCase();
  return {
    bank: {bankName: readValue(link, ['account_holder_name', 'accountHolderName', 'name']), institutionName: readValue(link, ['bank_name', 'bankName']), account: readValue(link, ['account_number', 'accountNumber']), ifsc: readValue(link, ['ifsc_code', 'ifscCode', 'ifsc'])},
    salon, address, beneficiary,
    verified: link.verified === true || link.is_verified === true || ['verified', 'success', 'active'].includes(state),
  };
};
const bankPayload = ({bankName, account, ifsc, salonId}) => ({account_holder_name: bankName.trim(), account_number: account.trim(), ifsc_code: ifsc.trim(), saloon_id: String(salonId)});
const verifyBankPayload = ({bankName, account, ifsc, salonId}) => ({account_holder_name: bankName.trim(), account_number: account.trim(), ifsc_code: ifsc.trim(), saloon_id: String(salonId)});
const isValidIfsc = value => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value).trim());
// The beneficiary service uses the canonical bank name returned by its API.
// The verification response returns YES BANK, while the create endpoint
// accepts the canonical value used by the successful API contract.
const beneficiaryBankName = value => String(value || '').trim().replace(/^yes bank$/i, 'Yes Bank');
const beneficiaryAccountHolder = ({verifiedAccountHolder, enteredAccountHolder}) =>
  String(verifiedAccountHolder || enteredAccountHolder || '').trim();
// The beneficiary endpoint accepts a flat payload.  Its bank verification
// response provides the institution name, while the onboarding state provides
// the salon/contact fields.
const beneficiaryPayload = ({bankName, institutionName, account, ifsc, salonId, salon = {}, address = {}, legalBusinessName}) => ({
  ...bankPayload({bankName, account, ifsc, salonId}),
  bank_name: beneficiaryBankName(institutionName),
  business_type: 'SALON',
  legal_business_name: String(legalBusinessName || salon.name || '').trim(),
  contact_name: String(salon.owner || '').trim(),
  contact_email: String(salon.email || '').trim(),
  contact_phone: String(salon.phone || '').trim(),
  address_line1: String(address.line1 || '').trim(),
  city: String(address.city || '').trim(),
  state: String(address.state || '').trim(),
  pincode: String(address.pincode || '').trim(),
  use_existing_beneficiary: false,
});
const canFetchSavedKyc = initialValues => Boolean(
  initialValues?.bank?.account || initialValues?.bank?.ifsc,
);
const errorCode = error => error?.data?.error?.code || error?.data?.code || error?.code || '';
const isExistingKycError = error => errorCode(error) === 'KYC_ALREADY_EXISTS' || /kyc already exists/i.test(error?.message || '');
const isExistingBeneficiaryError = error => error?.status === 409 && (
  errorCode(error) === 'KYC_ALREADY_EXISTS'
  || errorCode(error) === 'BENEFICIARY_ALREADY_EXISTS'
  || /(kyc|beneficiary) already exists/i.test(error?.message || '')
);
const requireSuccess = response => {
  if (response?.success === false) { throw new Error(response.message || 'Beneficiary request failed.'); }
  return response;
};
const readBeneficiary = response => {
  requireSuccess(response);
  const root = object(response?.data || response);
  const directRecord = (root.beneficiary_id || root.beneficiaryId
    || ((root.saloon_id || root.salon_id || root.saloonId || root.salonId)
      && (root.account_number || root.accountNumber)
      && (root.business_type || root.businessType || root.legal_business_name || root.legalBusinessName))) ? root : null;
  return object(root.beneficiary || root.beneficiaries?.[0] || root.data?.beneficiary || directRecord);
};
const kycAddressFromDetails = (details, location = '') => {
  const source = object(details);
  const locationParts = String(location).split(',').map(value => value.trim());
  return {
    line1: [source.door, source.building].filter(Boolean).join(', ') || String(location || ''),
    line2: [source.floor, source.landmark].filter(Boolean).join(', '),
    area: source.street || '',
    landmark: source.area || '',
    city: source.city || locationParts[0] || '',
    state: source.state || locationParts[1] || '',
    pincode: source.pincode || '',
  };
};

function KycDetailsScreen({basicDetails,addressDetails,salonRecord,initialValues,onBack,onSave}){
  const [bankName,setBankName]=useState(initialValues?.bank?.bankName||''); const [institutionName,setInstitutionName]=useState(initialValues?.bank?.institutionName||''); const [account,setAccount]=useState(initialValues?.bank?.account||''); const [ifsc,setIfsc]=useState(initialValues?.bank?.ifsc||'');
  const [verifiedAccountHolder,setVerifiedAccountHolder]=useState('');
  const [status,setStatus]=useState('idle');
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);
  const [beneficiary,setBeneficiary]=useState(null);
  const [beneficiaryLoading,setBeneficiaryLoading]=useState(true);
  const beneficiaryBusy=useRef(false);
  const contactName=salonRecord?.contact||'';
  const [salon,setSalon]=useState(initialValues?.salon||{name:basicDetails?.salonName||salonRecord?.name||'',owner:contactName,phone:basicDetails?.mobileNumber||salonRecord?.phone?.replace(/\s/g,'')||'',email:salonRecord?.email||(contactName?`${contactName.toLowerCase().replace(/\s+/g,'.')}@gmail.com`:'')});
  const [address,setAddress]=useState(initialValues?.address||kycAddressFromDetails(addressDetails?.details,salonRecord?.location));
  const bankValid=bankName.trim().length>1&&account.trim().length>=6&&isValidIfsc(ifsc);
  const salonId=basicDetails?.salonId||salonRecord?.saloon_id||salonRecord?.salon_id;
  useEffect(() => {
    let active = true;
    setBeneficiary(null);
    setBeneficiaryLoading(Boolean(salonId));
    if (!salonId) { return undefined; }
    onboardingService.getBeneficiary(salonId).then(response => {
      const saved = readBeneficiary(response);
      if (!active) { return; }
      setBeneficiary(Object.keys(saved).length ? saved : null);
    }).catch(error => {
      if (active) { Alert.alert('Unable to load beneficiary', error?.message || 'Please try again.'); }
    }).finally(() => { if (active) { setBeneficiaryLoading(false); } });
    return () => { active = false; };
  }, [salonId]);
  useEffect(()=>{let active=true;const loadAddress=async()=>{if(!salonId||addressDetails?.details)return;try{const saved=readAddress(await onboardingService.getAddress(salonId));if(active)setAddress(kycAddressFromDetails(saved.details,salonRecord?.location));}catch{/* Address loading is handled on the Address screen. */}};loadAddress();return()=>{active=false;};},[addressDetails,salonId,salonRecord?.location]);
  useEffect(()=>{let active=true;const load=async()=>{if(!salonId){if(active)setLoading(false);return;}try{const values=readKycDetails(await onboardingService.getKycDetails(salonId));if(!active)return;const found=Boolean(values.bank.account||values.bank.ifsc||values.bank.bankName);setBankName(current=>values.bank.bankName||current);setVerifiedAccountHolder(current=>values.bank.bankName||current);setInstitutionName(current=>values.bank.institutionName||current);setAccount(current=>values.bank.account||current);setIfsc(current=>values.bank.ifsc||current);if(Object.keys(values.salon).length)setSalon(current=>({...current,...values.salon}));if(Object.keys(values.address).length)setAddress(current=>({...current,...values.address}));if(found||values.verified)setStatus('verified');}catch(error){if(active&&error?.status!==404)Alert.alert('Unable to load KYC details',error?.message||'Please try again.');}finally{if(active)setLoading(false);}};load();return()=>{active=false;};},[salonId]);
  const setSalonField=k=>v=>setSalon(x=>({...x,[k]:v})); const setAddressField=k=>v=>setAddress(x=>({...x,[k]:v}));
  const verifyBank=async()=>{if(!bankValid||!salonId)return;setStatus('verifying');try{const response=await onboardingService.verifyBankAccount(verifyBankPayload({bankName,account,ifsc,salonId}));if(response?.success===false)throw new Error(response.message||'Bank verification failed.');const verified=readKycDetails(response);setVerifiedAccountHolder(current=>verified.bank.bankName||current);setInstitutionName(current=>verified.bank.institutionName||current);setStatus('verified');}catch(error){setStatus('idle');Alert.alert('Unable to verify bank details',error?.message||'Please check the account details and try again.');}};
  const saveKyc=async()=>{
    // Do not send a beneficiary request with partial KYC data.  A saved KYC
    // response can report VERIFIED while omitting the account number.
    if(saving||beneficiaryBusy.current||beneficiaryLoading||status!=='verified'||!bankValid||!salonId)return;
    beneficiaryBusy.current=true;
    setSaving(true);
    try {
      const submittedAccountHolder=beneficiaryAccountHolder({verifiedAccountHolder,enteredAccountHolder:bankName});
      const bank=bankPayload({bankName:submittedAccountHolder,account,ifsc,salonId});
      const values={bank:{bankName,account,ifsc},salon,address,beneficiary};
      // The beneficiary API creates the KYC submission itself.  Creating a
      // bank-account link first is a different flow and makes this endpoint
      // reject the same salon as an existing KYC record.
      if (!beneficiary) {
        try {
          // Use the lead's saved salon name for the API identifier.  The KYC
          // field remains editable for display, but its casing must not change
          // the legal business identifier expected by this endpoint.
          const response=requireSuccess(await onboardingService.createBeneficiary(beneficiaryPayload({bankName:submittedAccountHolder,institutionName,account,ifsc,salonId,salon,address,legalBusinessName:salonRecord?.name})));
          const created=readBeneficiary(response);
          if(Object.keys(created).length){values.beneficiary=created;}
        } catch (error) {
          if (!isExistingBeneficiaryError(error)) { throw error; }
          // A conflict is safe only when the saved bank details match this form.
          const saved=readBeneficiary(await onboardingService.getBeneficiary(salonId));
          const savedBank=readKycDetails(saved).bank;
          if(savedBank.bankName!==bank.account_holder_name||savedBank.account!==bank.account_number||savedBank.ifsc!==bank.ifsc_code){throw error;}
          setBeneficiary(saved);
          values.beneficiary=saved;
        }
      }
      onSave(values);
    }catch(error){Alert.alert('Unable to save KYC details',error?.message||'Please try again.');}
    finally{beneficiaryBusy.current=false;setSaving(false);}
  };
  return <SafeAreaView style={s.screen}><StatusBar barStyle="light-content" backgroundColor="#07113D"/>
    <View style={s.header}><Pressable accessibilityLabel="Go back" onPress={onBack} style={[s.back,s.backMedium]}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></Pressable><Text style={[s.headerTitle,s.headerTitleFont]}>KYC Details</Text></View><View style={s.progress}><Text style={s.step}>Step 8 of 8</Text><View style={s.track}><View style={s.fill}/></View></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.info}><Text style={s.infoIcon}>ⓘ</Text><Text style={s.infoText}>KYC information cannot be edited after submission</Text></View>
      <Text style={s.sectionTitle}>Bank Details</Text><View style={s.bankRow}><Field label="Name" value={bankName} onChangeText={v=>{setBankName(v);setStatus('idle');}} placeholder="Account holder"/><Field label="Account Number" value={account} onChangeText={v=>{setAccount(v.replace(/\D/g,''));setStatus('idle');}} placeholder="Account number" keyboardType="number-pad"/><Field label="IFSC Code" value={ifsc} onChangeText={v=>{setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,11));setStatus('idle');}} placeholder="IFSC code" maxLength={11}/></View>
      {status==='verifying'||loading?<View style={s.verifying}><View style={s.spinner}><View style={s.spinnerGap}/></View><Text style={s.verifyingTitle}>{loading?'Loading KYC details':'Verifying your account'}</Text><Text style={s.verifyingText}>{loading?'Please wait while we load your saved details.':<>Please wait while we verify your{`\n`}bank details.</>}</Text></View>:status==='verified'?<View style={s.success}><Image source={successIcon} resizeMode="contain" style={s.successIcon}/><Text style={s.successText}><Text style={s.successStrong}>Bank details verified successfully</Text>{`\n`}You can now complete salon details and address.</Text></View>:<View style={s.verifyBox}><View style={s.verifyInfo}><Text style={s.infoIcon}>ⓘ</Text><Text style={s.verifyCopy}>Bank details are required to verify your account.{`\n`}Please click below to verify.</Text></View><Pressable disabled={!bankValid} onPress={verifyBank} style={[s.verifyButton,!bankValid&&s.disabledOutline]}><Image source={verifyShieldIcon} resizeMode="contain" style={s.shieldIcon}/><Text style={s.verifyButtonText}>Verify Bank Details</Text></Pressable></View>}
      {status!=='verified'?<><LockedSection title="Salon Details"/><LockedSection title="Address"/></>:<><View style={s.unlocked}><Text style={s.sectionTitle}>Salon Details</Text><View style={s.twoCols}><Field label="Salon Name" value={salon.name} onChangeText={setSalonField('name')} placeholder="Salon name"/><Field label="Owner Name" value={salon.owner} onChangeText={setSalonField('owner')} placeholder="Owner name"/></View><View style={s.twoCols}><Field label="Phone Number" value={salon.phone} onChangeText={setSalonField('phone')} placeholder="Phone number" keyboardType="phone-pad"/><Field label="Email" value={salon.email} onChangeText={setSalonField('email')} placeholder="Email address"/></View></View><View style={s.unlocked}><Text style={s.sectionTitle}>Address</Text><Field label="Address Line 1" value={address.line1} onChangeText={setAddressField('line1')} placeholder="Address line 1"/><Field label="Address Line 2" value={address.line2} onChangeText={setAddressField('line2')} placeholder="Address line 2"/><View style={s.twoCols}><Field label="Street" value={address.area} onChangeText={setAddressField('area')} placeholder="Street"/><Field label="Area / Locality" value={address.landmark} onChangeText={setAddressField('landmark')} placeholder="Area"/></View><View style={s.twoCols}><Field label="City" value={address.city} onChangeText={setAddressField('city')} placeholder="City"/><Field label="State" value={address.state} onChangeText={setAddressField('state')} placeholder="State"/></View><Field label="Pincode" value={address.pincode} onChangeText={setAddressField('pincode')} placeholder="Pincode" keyboardType="number-pad"/></View></>}
    </ScrollView><View style={s.footer}><Pressable onPress={onBack} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={status!=='verified'||!bankValid||saving} onPress={saveKyc} style={[s.save,(status!=='verified'||!bankValid||saving)&&s.disabled]}><Text style={[s.saveText,(status!=='verified'||!bankValid||saving)&&s.disabledText]}>{saving?'Saving...':'Save & Continue'}</Text></Pressable></View>
  </SafeAreaView>;
}
function LockedSection({title}){return <View style={s.locked}><LockIcon/><View><Text style={s.lockedTitle}>{title}</Text><Text style={s.lockedText}>Complete bank verification to continue</Text></View></View>;}

const s=StyleSheet.create({
screen:{flex:1,backgroundColor:'#F6F7FB'},header:{height:55,backgroundColor:'#07113D',flexDirection:'row',alignItems:'center',paddingHorizontal:14},back:{width:36},backText:{fontSize:33,color:'#FFF'},headerTitle:{fontSize:17,color:'#FFF',fontWeight:'600'},progress:{backgroundColor:'#07113D',paddingHorizontal:20,paddingBottom:15},step:{fontSize:13,color:'#FFF',marginBottom:9},track:{height:6,borderRadius:4,backgroundColor:'#61749C',overflow:'hidden'},fill:{width:'100%',height:'100%',backgroundColor:'#91B8F4'},content:{padding:12,paddingBottom:24},info:{minHeight:43,padding:10,borderRadius:7,backgroundColor:'#F0F4FC',flexDirection:'row',alignItems:'center'},infoIcon:{fontSize:15,color:'#2670E8',marginRight:9},infoText:{fontSize:9,color:'#334E83',fontWeight:'600'},sectionTitle:{fontSize:12,color:'#17213E',fontWeight:'700',marginTop:20,marginBottom:11},bankRow:{flexDirection:'row',gap:8,marginBottom:5},fieldWrap:{flex:1,marginBottom:4},label:{fontSize:8,color:'#24304E',fontWeight:'600',marginBottom:7},required:{color:'#E33347'},input:{height:40,borderWidth:1,borderColor:'#DCE2EC',borderRadius:6,paddingHorizontal:8,fontSize:9,color:'#202A47',backgroundColor:'#FFF'},verifyBox:{marginTop:18,padding:13,borderRadius:8,backgroundColor:'#F2F5FB'},verifyInfo:{flexDirection:'row',alignItems:'flex-start'},verifyCopy:{fontSize:9,lineHeight:15,color:'#3260B5'},verifyButton:{height:44,marginTop:13,borderWidth:1,borderColor:'#3473ED',borderRadius:6,flexDirection:'row',alignItems:'center',justifyContent:'center'},verifyButtonText:{fontSize:10,color:'#2864D5',fontWeight:'700'},disabledOutline:{opacity:.45},shieldIcon:{width:21,height:23,marginRight:9},verifying:{height:145,marginTop:18,borderRadius:8,backgroundColor:'#F2F5FB',alignItems:'center',justifyContent:'center'},spinner:{width:34,height:34,borderRadius:17,borderWidth:4,borderColor:'#4C8AF3',marginBottom:13},spinnerGap:{position:'absolute',right:-5,top:-5,width:17,height:14,backgroundColor:'#F2F5FB'},verifyingTitle:{fontSize:11,color:'#1C2948',fontWeight:'700'},verifyingText:{fontSize:9,lineHeight:14,color:'#5A6680',textAlign:'center',marginTop:7},success:{minHeight:54,marginTop:18,padding:11,borderRadius:7,backgroundColor:'#EEF8EF',flexDirection:'row',alignItems:'center'},successIcon:{width:22,height:22,marginRight:9},successText:{fontSize:8,lineHeight:13,color:'#50805B'},successStrong:{color:'#288347',fontWeight:'700'},locked:{minHeight:70,marginTop:18,padding:14,borderRadius:8,backgroundColor:'#F3F5F9',flexDirection:'row',alignItems:'center'},lock:{width:23,height:27,marginRight:12,alignItems:'center',justifyContent:'flex-end'},shackle:{position:'absolute',top:0,width:14,height:13,borderWidth:2,borderBottomWidth:0,borderColor:'#657087',borderTopLeftRadius:7,borderTopRightRadius:7},lockBody:{width:19,height:16,borderRadius:3,backgroundColor:'#657087',alignItems:'center',justifyContent:'center'},keyhole:{width:4,height:7,borderRadius:2,backgroundColor:'#FFF'},lockedTitle:{fontSize:11,color:'#2B354F',fontWeight:'700'},lockedText:{fontSize:8,color:'#7A8498',marginTop:7},unlocked:{marginTop:7},twoCols:{flexDirection:'row',gap:9,marginBottom:12},footer:{height:70,padding:10,backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#E2E5EC',flexDirection:'row',gap:10},cancel:{flex:1,height:44,borderWidth:1,borderColor:'#3168DE',borderRadius:6,alignItems:'center',justifyContent:'center'},cancelText:{fontSize:11,color:'#2052B1',fontWeight:'600'},save:{flex:1.1,height:44,borderRadius:6,backgroundColor:'#07113D',alignItems:'center',justifyContent:'center'},saveText:{fontSize:11,color:'#FFF',fontWeight:'600'},disabled:{backgroundColor:'#ECEEF3'},disabledText:{color:'#BBC1CD'},
backMedium:{height:40,alignItems:'flex-start',justifyContent:'center'},
headerTitleFont:{fontFamily:'Poppins_600SemiBold'},
});
export {bankPayload, beneficiaryAccountHolder, beneficiaryBankName, beneficiaryPayload, canFetchSavedKyc, errorCode, isExistingBeneficiaryError, isExistingKycError, isValidIfsc, kycAddressFromDetails, readKycDetails, verifyBankPayload};
export default KycDetailsScreen;
