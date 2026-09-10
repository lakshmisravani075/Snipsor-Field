import React, {useCallback, useEffect, useState} from 'react';
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
import BasicDetailsScreen from './BasicDetailsScreen';
import FilesMediaScreen from './FilesMediaScreen.js';
import AddressScreen from './AddressScreen.js';
import ServicesScreen from './ServicesScreen.js';
import EmployeesScreen from './EmployeesScreen.js';
import SalonAvailabilityScreen from './SalonAvailabilityScreen.js';
import EmployeeAvailabilityScreen from './EmployeeAvailabilityScreen.js';
import KycDetailsScreen from './KycDetailsScreen.js';
import OnboardingStatusScreen from './OnboardingStatusScreen.js';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import {onboardingService} from '../../../services/apiService.js';
import {extractSavedSalonId, readSavedBeneficiary} from '../onboardingTasks.js';

const shopIcon = require('../../../assets/icons/detail-shop.png');
const onboardingStateBySalon = new Map();

const STEPS = [
  'Basic Details',
  'Files & Media',
  'Address',
  'Services',
  'Employees',
  'Salon Availability',
  'Employee Availability',
  'KYC',
];

const asBoolean = value => value === true || value === 1 || ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());

const readBasicDetails = (response, salonId) => {
  if (!response || response.success === false) { return null; }
  const container = response.data || response;
  const record = container.salon_details || container.saloon_details || container.salon || container.saloon || container;
  const name = record?.name ?? record?.salon_name ?? record?.salonName;
  if (!record || typeof record !== 'object' || Array.isArray(record) || !name) { return null; }
  const phone = String(record.mobile_number ?? record.mobileNumber ?? record.phone_number ?? record.phoneNumber ?? record.mobile ?? record.phone ?? '').replace(/\D/g, '');
  const gstDetails = record.gst_details || record.gstDetails || {};
  return {
    salonId: String(salonId),
    salonName: String(name),
    mobileNumber: phone.length === 12 && phone.startsWith('91') ? phone.slice(2) : phone,
    salonType: String(record.salon_type ?? record.salonType ?? ''),
    gstRegistered: asBoolean(record.is_gst_registered ?? record.gst_registered ?? record.gstRegistered ?? record.gst_number_registered ?? record.is_gst_number_registered ?? gstDetails.registered ?? gstDetails.is_registered),
    priceExclusive: typeof record.price_includes_tax === 'boolean' ? !record.price_includes_tax : Boolean(record.price_exclusive ?? record.priceExclusive),
    gstNumber: String(record.gst_info ?? record.gst_number ?? record.gstNumber ?? record.gstin ?? record.gstin_number ?? record.gst_no ?? gstDetails.gst_number ?? gstDetails.gstin ?? ''),
  };
};

function ProgressStep({label, index, basicComplete, filesComplete, addressComplete, servicesComplete, employeesComplete, availabilityComplete, employeeAvailabilityComplete, kycComplete, enabled, onPress}) {
  const step = index + 1;
  const isComplete = (step === 1 && basicComplete) || (step === 2 && filesComplete) || (step === 3 && addressComplete) || (step === 4 && servicesComplete) || (step === 5 && employeesComplete) || (step === 6 && availabilityComplete) || (step === 7 && employeeAvailabilityComplete) || (step === 8 && kycComplete);
  const isCurrent = !kycComplete && (employeeAvailabilityComplete ? step === 8 : availabilityComplete ? step === 7 : employeesComplete ? step === 6 : servicesComplete ? step === 5 : addressComplete ? step === 4 : filesComplete ? step === 3 : basicComplete ? step === 2 : step === 1);
  return (
    <Pressable accessibilityRole="button" disabled={!enabled} hitSlop={4} onPress={() => onPress(step)} style={[styles.stepRow, isCurrent && styles.currentStepRow]}>
      {index < STEPS.length - 1 && <View style={[styles.stepLine, isComplete && styles.stepLineComplete]} />}
      {isComplete ? <Ionicons name="checkmark-circle" size={24} color="#20A765" /> : <View style={[styles.stepCircle, isCurrent && styles.currentCircle]}><Text style={[styles.stepNumber, isCurrent && styles.activeStepNumber]}>{step}</Text></View>}
      <Text style={[styles.stepLabel, isComplete && styles.completeLabel, isCurrent && styles.currentLabel]}>{label}</Text>
      {isComplete && <Ionicons name="checkmark-circle" size={18} color="#20A765" />}
    </Pressable>
  );
}

function SalonOnboardingScreen({salon, onBack, onOnboardingComplete}) {
  const savedState = onboardingStateBySalon.get(salon.leadId) || {};
  const persist = useCallback(values => {
    onboardingStateBySalon.set(salon.leadId, {...(onboardingStateBySalon.get(salon.leadId) || {}), ...values});
  }, [salon.leadId]);
  const savedSalonId = salon.saloon_id || salon.salon_id;
  const prefetchedBasicDetails = readBasicDetails(salon.prefetchedBasicDetails, savedSalonId);
  const savedResumeStep = savedState.employeeAvailabilityComplete ? 8 : savedState.availabilityComplete ? 7 : savedState.employeesComplete ? 6 : savedState.servicesComplete ? 5 : savedState.addressComplete ? 4 : savedState.filesComplete ? 3 : savedState.basicComplete ? 2 : null;
  const timelineResumeStep = salon.onboardingStep || 1;
  // A complete saved Basic Details record means the next unfinished screen is
  // Files & Media when an older timeline response still reports step 1.
  const resumeStep = salon.status === 'KYC Pending' ? 8 : savedResumeStep || (prefetchedBasicDetails && timelineResumeStep === 1 ? 2 : timelineResumeStep);
  // The list status can lag behind the actual onboarding record.  A saved
  // salon ID or an API timeline step is authoritative for resume behavior.
  const shouldResume = salon.status !== 'New' || Boolean(extractSavedSalonId(salon)) || resumeStep > 1;
  const [showBasicDetails, setShowBasicDetails] = useState(shouldResume && resumeStep === 1);
  const [basicComplete, setBasicComplete] = useState(Boolean(savedState.basicComplete || prefetchedBasicDetails || resumeStep > 1));
  const [basicDetails, setBasicDetails] = useState(savedState.basicDetails || prefetchedBasicDetails || null);
  const [showFilesMedia, setShowFilesMedia] = useState(shouldResume && resumeStep === 2);
  const [filesComplete, setFilesComplete] = useState(Boolean(savedState.filesComplete || resumeStep > 2));
  const [salonPhotos, setSalonPhotos] = useState(savedState.salonPhotos || []);
  const [showAddress, setShowAddress] = useState(shouldResume && resumeStep === 3);
  const [addressComplete, setAddressComplete] = useState(Boolean(savedState.addressComplete || resumeStep > 3));
  const [addressDetails, setAddressDetails] = useState(savedState.addressDetails || null);
  const [showServices, setShowServices] = useState(shouldResume && resumeStep === 4);
  const [servicesComplete, setServicesComplete] = useState(Boolean(savedState.servicesComplete || resumeStep > 4));
  const [salonServices, setSalonServices] = useState(savedState.salonServices || []);
  const [showEmployees, setShowEmployees] = useState(shouldResume && resumeStep === 5);
  const [employeesComplete, setEmployeesComplete] = useState(Boolean(savedState.employeesComplete || resumeStep > 5));
  const [salonEmployees, setSalonEmployees] = useState(savedState.salonEmployees || []);
  const [showAvailability, setShowAvailability] = useState(shouldResume && resumeStep === 6);
  const [availabilityComplete, setAvailabilityComplete] = useState(Boolean(savedState.availabilityComplete || resumeStep > 6));
  const [salonAvailability, setSalonAvailability] = useState(savedState.salonAvailability || []);
  const [showEmployeeAvailability, setShowEmployeeAvailability] = useState(shouldResume && resumeStep === 7);
  const [employeeAvailabilityComplete, setEmployeeAvailabilityComplete] = useState(Boolean(savedState.employeeAvailabilityComplete || resumeStep > 7));
  const [employeeAvailability, setEmployeeAvailability] = useState(savedState.employeeAvailability || null);
  const [showKyc, setShowKyc] = useState(shouldResume && resumeStep === 8);
  const [kycDetails, setKycDetails] = useState(savedState.kycDetails || null);
  const [kycComplete, setKycComplete] = useState(Boolean(savedState.kycComplete));
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const basicDetailsSalonId = basicDetails?.salonId || savedSalonId;
  const viewingSubmission = Boolean(submissionStatus);

  useEffect(() => {
    if (!basicDetailsSalonId || savedState.kycComplete) { return undefined; }
    let active = true;
    const restoreSavedKyc = async () => {
      try {
        const beneficiary = readSavedBeneficiary(await onboardingService.getBeneficiary(basicDetailsSalonId));
        if (!active || !beneficiary) { return; }
        setKycDetails(current => ({...(current || {}), beneficiary}));
        setKycComplete(true);
        persist({kycDetails: {beneficiary}, kycComplete: true});
        // A stale KYC_PENDING lead status can otherwise reopen the form even
        // though the KYC record is already present on the server.
        setShowKyc(false);
      } catch {
        // No saved beneficiary simply means this salon still needs KYC.
      }
    };
    restoreSavedKyc();
    return () => { active = false; };
  }, [basicDetailsSalonId, persist, savedState.kycComplete]);

  useEffect(() => {
    if (!basicDetailsSalonId) { return undefined; }
    let active = true;
    persist({onboardingStatusLoading: true, onboardingStatusError: null});
    onboardingService.getOnboardingStatus(basicDetailsSalonId).then(response => {
      // No backend status contract is available. Retain the original response
      // without inferring completion flags or changing the existing KYC flow.
      if (active) { persist({onboardingStatusResponse: response, onboardingStatusLoading: false}); }
    }).catch(error => {
      if (active) { persist({onboardingStatusError: error.message, onboardingStatusLoading: false}); }
    });
    return () => { active = false; };
  }, [basicDetailsSalonId, persist, viewingSubmission]);

  useEffect(() => {
    if (!basicDetailsSalonId || basicDetails) { return undefined; }
    let active = true;
    const loadSavedBasicDetails = async () => {
      try {
        const response = await onboardingService.getBasicDetails(basicDetailsSalonId);
        const values = readBasicDetails(response, basicDetailsSalonId);
        if (!values) { return; }
        if (!active) { return; }
        setBasicDetails(values);
        setBasicComplete(true);
        persist({basicDetails: values, basicComplete: true});
      } catch {
        // The individual Basic Details screen shows the existing retry alert.
      }
    };
    loadSavedBasicDetails();
    return () => { active = false; };
  }, [basicDetails, basicDetailsSalonId, persist]);

  const openOnboardingStep = step => {
    if (step === 1) {
      setShowBasicDetails(true);
      return;
    }
    if (step === 2) {
      setShowFilesMedia(true);
      return;
    }
    if (step === 3) {
      setShowAddress(true);
      return;
    }
    if (step === 4) {
      setShowServices(true);
      return;
    }
    if (step === 5) {
      setShowEmployees(true);
      return;
    }
    if (step === 6) {
      setShowAvailability(true);
      return;
    }
    if (step === 7) {
      setShowEmployeeAvailability(true);
      return;
    }
    if (step === 8) {
      setShowKyc(true);
    }
  };

  if (showBasicDetails) {
    return (
      <BasicDetailsScreen
        initialValues={basicDetails}
        salon={salon}
        onBack={() => setShowBasicDetails(false)}
        onSave={values => {
          setBasicDetails(values);
          setBasicComplete(true);
          persist({basicDetails: values, basicComplete: true});
          setShowBasicDetails(false);
        }}
      />
    );
  }

  if (showFilesMedia) {
    return (
      <FilesMediaScreen
        salonId={basicDetails?.salonId || salon.saloon_id || salon.salon_id}
        initialPhotos={salonPhotos}
        onImagesChanged={photos => {
          const complete = photos.length > 0 && photos.every(photo => photo.uploaded);
          setSalonPhotos(photos);
          setFilesComplete(complete);
          persist({salonPhotos: photos, filesComplete: complete});
        }}
        onBack={() => setShowFilesMedia(false)}
        onSave={photos => {
          setSalonPhotos(photos);
          setFilesComplete(true);
          persist({salonPhotos: photos, filesComplete: true});
          setShowFilesMedia(false);
        }}
      />
    );
  }

  if (showAddress) {
    return <AddressScreen salonId={basicDetails?.salonId || salon.saloon_id || salon.salon_id} initialValues={addressDetails} onAddressVerified={complete => { setAddressComplete(complete); persist({addressComplete: complete}); }} onBack={() => setShowAddress(false)} onSave={values => { setAddressDetails(values); setAddressComplete(true); persist({addressDetails: values, addressComplete: true}); setShowAddress(false); }} />;
  }

  if (showServices) {
    return <ServicesScreen salonId={basicDetails?.salonId || salon.saloon_id || salon.salon_id} salonType={basicDetails?.salonType || 'Unisex'} initialServices={salonServices} onBack={() => setShowServices(false)} onSave={values => { setSalonServices(values); setServicesComplete(true); persist({salonServices: values, servicesComplete: true}); setShowServices(false); }} />;
  }

  if (showEmployees) {
    return <EmployeesScreen salonId={basicDetails?.salonId || salon.saloon_id || salon.salon_id} initialAddress={addressDetails} onAddressSaved={values => { setAddressDetails(values); setAddressComplete(true); persist({addressDetails: values, addressComplete: true}); }} initialEmployees={salonEmployees} onBack={() => setShowEmployees(false)} onSaveContinue={values => { setSalonEmployees(values); setEmployeesComplete(true); persist({salonEmployees: values, employeesComplete: true}); setShowEmployees(false); }} />;
  }

  if (showAvailability) {
    return <SalonAvailabilityScreen salonId={basicDetails?.salonId || salon.saloon_id || salon.salon_id} initialDays={salonAvailability} onBack={() => setShowAvailability(false)} onSave={values => { setSalonAvailability(values); setAvailabilityComplete(true); persist({salonAvailability: values, availabilityComplete: true}); setShowAvailability(false); }} />;
  }

  if (showEmployeeAvailability) {
    return <EmployeeAvailabilityScreen salonId={basicDetails?.salonId || salon.saloon_id || salon.salon_id} employees={salonEmployees} salonDays={salonAvailability} initialDays={employeeAvailability?.days} onBack={() => setShowEmployeeAvailability(false)} onSave={values => { setEmployeeAvailability(values); setEmployeeAvailabilityComplete(true); persist({employeeAvailability: values, employeeAvailabilityComplete: true}); setShowEmployeeAvailability(false); }} />;
  }

  if (showKyc) {
    return <KycDetailsScreen basicDetails={basicDetails} addressDetails={addressDetails} salonRecord={salon} initialValues={kycDetails} onBack={() => setShowKyc(false)} onSave={values => { setKycDetails(values); setKycComplete(true); persist({kycDetails: values, kycComplete: true}); setShowKyc(false); }} />;
  }

  if (submissionStatus) {
    return <OnboardingStatusScreen status={submissionStatus} salon={salon} onBack={onBack} onViewKyc={() => {setSubmissionStatus(null); setShowKyc(true);}} onFixKyc={() => {setSubmissionStatus(null); setShowKyc(true);}} />;
  }

  const activeStep = kycComplete ? 8 : employeeAvailabilityComplete ? 8 : availabilityComplete ? 7 : employeesComplete ? 6 : servicesComplete ? 5 : addressComplete ? 4 : filesComplete ? 3 : basicComplete ? 2 : 1;
  const continueOnboarding = () => {
    if (kycComplete) {
      if (onOnboardingComplete) { onOnboardingComplete(); }
      else { setSubmissionStatus(kycDetails?.reviewStatus || 'submitted'); }
    } else if (!basicComplete) { setShowBasicDetails(true); }
    else if (!filesComplete) { setShowFilesMedia(true); }
    else if (!addressComplete) { setShowAddress(true); }
    else if (!servicesComplete) { setShowServices(true); }
    else if (!employeesComplete) { setShowEmployees(true); }
    else if (!availabilityComplete) { setShowAvailability(true); }
    else if (!employeeAvailabilityComplete) { setShowEmployeeAvailability(true); }
    else { setShowKyc(true); }
  };
  const continueLabel = kycComplete ? 'Submit Onboarding'
    : !basicComplete ? 'Start Basic Details'
      : !filesComplete ? 'Continue Files & Media'
        : !addressComplete ? 'Continue Address'
          : !servicesComplete ? 'Continue Services'
            : !employeesComplete ? 'Continue Employees'
              : !availabilityComplete ? 'Continue Salon Availability'
                : !employeeAvailabilityComplete ? 'Continue Employee Availability'
                  : 'Continue KYC';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></Pressable>
        <Text style={styles.headerTitle}>Salon Details</Text>
        <Pressable accessibilityLabel="Notifications" style={styles.notification}><Ionicons name="notifications-outline" size={23} color="#FFFFFF" /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.salonCard}>
          <View style={styles.shopTile}><Image source={shopIcon} resizeMode="contain" style={styles.shopImage} /></View>
          <View style={styles.salonCopy}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.salonName}>{salon.name}</Text><Text style={styles.salonType}>Unisex Salon</Text><View style={styles.salonLocationRow}><Ionicons name="location-outline" size={11} color="#69718A" /><Text numberOfLines={1} adjustsFontSizeToFit style={styles.salonLocation}>{salon.location?.replace(/\s+/g, ' ').trim()}</Text></View></View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.leadId}>{salon.leadId}</Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}><Text style={styles.progressTitle}>Onboarding Progress</Text><View style={styles.stepPill}><Text style={styles.stepPillText}>Step {activeStep} of 8</Text></View></View>
          <View style={styles.steps}>{STEPS.map((step, index) => <ProgressStep key={step} label={step} index={index} basicComplete={basicComplete} filesComplete={filesComplete} addressComplete={addressComplete} servicesComplete={servicesComplete} employeesComplete={employeesComplete} availabilityComplete={availabilityComplete} employeeAvailabilityComplete={employeeAvailabilityComplete} kycComplete={kycComplete} enabled={index <= 7} onPress={openOnboardingStep} />)}</View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={continueOnboarding} style={({pressed}) => [styles.continueButton, pressed && styles.pressed]}><Text style={styles.continueText}>{continueLabel}</Text><Ionicons name="chevron-forward" size={17} color="#FFFFFF" /></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 62, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14},
  backButton: {width: 30, height: 40, justifyContent: 'center', marginRight: 9},
  backArrow: {color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '400'},
  headerTitle: {flex: 1, color: '#FFFFFF', fontSize: 17, fontFamily: 'Poppins_600SemiBold'},
  notification: {width: 34, height: 34, alignItems: 'center', justifyContent: 'center'},
  notificationIcon: {width: 24, height: 24, tintColor: '#FFFFFF'},
  content: {padding: 14, paddingBottom: 20},
  salonCard: {minHeight: 86, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7F0', backgroundColor: '#FFFFFF', padding: 11, flexDirection: 'row', alignItems: 'center'},
  shopTile: {width: 58, height: 58, borderRadius: 10, backgroundColor: '#F1EEFF', alignItems: 'center', justifyContent: 'center'},
  shopImage: {width: 38, height: 38, tintColor: '#5637EF'},
  salonCopy: {flex: 1, marginLeft: 12, marginRight: 126},
  salonName: {color: '#111735', fontSize: 15, fontFamily: 'Poppins_600SemiBold'},
  salonType: {color: '#626982', fontSize: 9, marginTop: 3},
  salonLocationRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5},
  salonLocation: {flexShrink: 1, color: '#626982', fontSize: 10, fontFamily: 'Inter_400Regular', fontWeight: '300'},
  leadId: {position: 'absolute', top: 11, right: 11, width: 120, color: '#9A9EB0', fontSize: 7.5, textAlign: 'right'},
  progressCard: {marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7F0', backgroundColor: '#FFFFFF', padding: 13},
  progressHeader: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  progressTitle: {color: '#111735', fontSize: 15, fontWeight: '600'},
  stepPill: {height: 25, borderRadius: 13, backgroundColor: '#EEECFF', justifyContent: 'center', paddingHorizontal: 10},
  stepPillText: {color: '#5036E9', fontSize: 9, fontWeight: '600'},
  steps: {paddingTop: 8},
  stepRow: {height: 53, flexDirection: 'row', alignItems: 'center', position: 'relative', paddingHorizontal: 5},
  currentStepRow: {height: 55, borderRadius: 8, borderWidth: 1, borderColor: '#D9D6FF', backgroundColor: '#F7F6FF', paddingHorizontal: 5},
  stepLine: {position: 'absolute', left: 20, top: 38, width: 2, height: 30, backgroundColor: '#DCE0EA'},
  stepLineComplete: {backgroundColor: '#24B86A'},
  stepCircle: {width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#BAC2D3', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 1},
  completeStepIcon: {width: 30, height: 30, zIndex: 1},
  currentCircle: {borderColor: '#4932EF', backgroundColor: '#4932EF'},
  stepNumber: {color: '#9AA2B6', fontSize: 11, fontWeight: '600'},
  activeStepNumber: {color: '#FFFFFF'},
  stepLabel: {color: '#5F6782', fontSize: 12.5, fontWeight: '500', marginLeft: 12},
  completeLabel: {color: '#34405F'},
  currentLabel: {color: '#3E32C7', fontWeight: '600'},
  completeBadgeIcon: {marginLeft: 'auto', width: 25, height: 25},
  footer: {height: 70, paddingHorizontal: 14, paddingTop: 9, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E8F0'},
  continueButton: {height: 46, borderRadius: 7, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13},
  continueText: {color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold'},
  continueArrow: {position: 'absolute', right: 13, color: '#FFFFFF', fontSize: 25, lineHeight: 25},
  pressed: {opacity: 0.87},
});

export default SalonOnboardingScreen;
