import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
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
import TaskDetailsScreen from './TaskDetailsScreen.js';
import OnboardingSalonsScreen from './OnboardingSalonsScreen.js';
import SalonOnboardingScreen from './SalonOnboardingScreen.js';
import LogoutScreen from '../../profile/LogoutScreen.js';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import {leadService, onboardingService} from '../../../services/apiService.js';
import {extractSavedSalonId, extractTaskLeads, formatAssignedOn, mergeTaskDetails, normalizeOnboardingTask, readSavedBeneficiary, resolveOnboardingResumeStep} from '../onboardingTasks.js';

const STATUS_COLORS = {
  New: {text: '#5A39EF', background: '#F0EDFF', icon: '#775DFF'},
  'In Progress': {text: '#3477F4', background: '#EAF3FF', icon: '#5C8BFF'},
  'KYC Pending': {text: '#E49322', background: '#FFF3DD', icon: '#F2A83B'},
};

function ShopIcon({color}) {
  return <View style={[styles.shopTile, {backgroundColor: `${color}18`}]}><Ionicons name="storefront-outline" size={22} color={color} /></View>;
}

function TaskCard({task, onPress, onOnboard, isLoading}) {
  const palette = STATUS_COLORS[task.status];
  const assignment = task.assignee && task.assignee !== 'Name unavailable'
    ? `Assigned to: ${task.assignee}`
    : task.assignedOn ? `Assigned on: ${formatAssignedOn(task.assignedOn)}` : 'Assignment pending';
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.taskCard, pressed && styles.taskCardPressed]}>
      <View style={styles.taskTop}>
        <ShopIcon color={palette.icon} />
        <View style={styles.taskInfo}>
          <Text style={styles.taskName}>{task.name}</Text>
          <View style={styles.detailRow}><Ionicons name="location-outline" size={10} color="#687087" /><Text numberOfLines={1} style={styles.detailLine}>{task.location}</Text></View>
          <View style={styles.detailRow}><Ionicons name="person-outline" size={10} color="#687087" /><Text style={styles.detailLine}>{task.contact}  •  {task.phone}</Text></View>
          <View style={styles.detailRow}><Ionicons name="calendar-outline" size={10} color="#687087" /><Text style={styles.detailLine}>{assignment}</Text></View>
        </View>
      </View>
      <Pressable disabled={isLoading} accessibilityState={{busy: isLoading}} onPress={event => { event.stopPropagation(); onOnboard(); }} style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.actionText}>{isLoading ? 'Loading...' : task.status === 'New' ? 'Start Onboarding' : 'Continue Onboarding'}</Text>
      </Pressable>
      <View style={styles.cardFooter}>
        <View style={styles.detailRow}><Ionicons name="navigate-outline" size={9} color="#6B48EE" /><Text style={styles.activity}>{task.activity}</Text></View>
        <Text style={styles.leadId}>Lead ID: {task.leadId}</Text>
      </View>
    </Pressable>
  );
}

function NavIcon({type, active}) {
  const color = active ? '#3159C8' : '#71778E';
  const name = type === 'tasks' ? 'clipboard-outline' : type === 'salons' ? 'storefront-outline' : 'person-outline';
  return <Ionicons name={name} size={22} color={color} />;
}

function OnboardingTasksScreen({onLogout}) {
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [onboardingTask, setOnboardingTask] = useState(null);
  const [completedLeadIds, setCompletedLeadIds] = useState([]);
  const [activeTab, setActiveTab] = useState('tasks');
  const [profileOrigin, setProfileOrigin] = useState('tasks');
  const [loadingLeadId, setLoadingLeadId] = useState(null);
  const timelineRequest = useRef({version: 0, loading: false});
  useEffect(() => {
    const request = timelineRequest.current;
    setLoadingLeadId(null);
    return () => {
      request.version += 1;
      request.loading = false;
    };
  }, [activeTab, selectedTask, onboardingTask]);
  const openOnboarding = async task => {
    if (timelineRequest.current.loading) { return; }
    // A genuinely new lead has no onboarding record yet.  Do not make that
    // first-start path depend on a timeline that does not exist.  Once a
    // salon ID or a later step is present, always refresh from the backend,
    // even if a stale list response still labels the lead as "New".
    const hasSavedOnboarding = Boolean(extractSavedSalonId(task)) || Number(task?.onboardingStep) > 1;
    if (task?.status === 'New' && !hasSavedOnboarding) {
      setOnboardingTask(task);
      setSelectedTask(null);
      return;
    }
    const leadId = task?.leadId;
    if (!leadId) {
      Alert.alert('Unable to continue onboarding', 'The selected lead does not have a valid ID.');
      return;
    }
    const version = ++timelineRequest.current.version;
    timelineRequest.current.loading = true;
    setLoadingLeadId(leadId);
    try {
      const [timeline, leadDetails] = await Promise.all([
        leadService.getOnboardingTimeline(leadId),
        leadService.getLeadDetails(leadId),
      ]);
      if (version !== timelineRequest.current.version) { return; }
      if (timeline == null || typeof timeline !== 'object' || timeline.success === false) {
        throw new Error(typeof timeline?.message === 'string' ? timeline.message : 'Unable to load the onboarding timeline. Please try again.');
      }
      const latestTask = mergeTaskDetails(leadDetails, task);
      // Lead details and timeline are returned by different backend versions.
      // Prefer a freshly discovered saved salon ID over the list's stale value
      // so each step loads the same persisted onboarding record immediately.
      const savedSalonId = extractSavedSalonId(leadDetails) || extractSavedSalonId(timeline) || extractSavedSalonId(latestTask);
      // Hydrate Basic Details before mounting the onboarding screen.  Previously
      // the form mounted empty while its own request was still in flight; going
      // back gave that request time to finish, which made the second tap appear
      // to work.  A failed hydration must not block a valid resume timeline.
      let prefetchedBasicDetails = null;
      if (savedSalonId && onboardingService?.getBasicDetails) {
        try {
          prefetchedBasicDetails = await onboardingService.getBasicDetails(savedSalonId);
        } catch {
          // The form retains its existing retry handling if this read fails.
        }
      }
      if (version !== timelineRequest.current.version) { return; }
      setOnboardingTask({...latestTask, ...(savedSalonId ? {salon_id: savedSalonId} : {}), onboardingStep: resolveOnboardingResumeStep(timeline, latestTask.onboardingStep), onboardingTimeline: timeline, prefetchedBasicDetails});
      setSelectedTask(null);
    } catch (error) {
      if (version !== timelineRequest.current.version) { return; }
      if (error?.status === 401) {
        Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onLogout}]);
      } else {
        Alert.alert('Unable to continue onboarding', error?.message || 'Please try again.');
      }
    } finally {
      if (version === timelineRequest.current.version) {
        timelineRequest.current.loading = false;
        setLoadingLeadId(null);
      }
    }
  };
  useEffect(() => {
    if (selectedTask || onboardingTask || activeTab === 'profile') {
      return undefined;
    }
    let mounted = true;
    const loadTasks = async () => {
      if (!mounted) { return; }
      try {
        const response = await leadService.getLeads();
        // Completed salons belong to the Activation API, not the onboarding
        // queue. A lead-list status can lag behind a successful KYC submission,
        // so also use the persisted beneficiary as the durable completion
        // signal. This prevents a submitted salon from reopening at Step 8
        // after navigating back, refreshing, or signing in again.
        const pendingTasks = extractTaskLeads(response).map(normalizeOnboardingTask)
          .filter(task => !task.onboardingComplete && !completedLeadIds.includes(task.leadId));
        const nextTasks = (await Promise.all(pendingTasks.map(async task => {
          const salonId = extractSavedSalonId(task);
          if (!salonId || !onboardingService?.getBeneficiary) { return task; }
          try {
            return readSavedBeneficiary(await onboardingService.getBeneficiary(salonId)) ? null : task;
          } catch {
            // A beneficiary lookup must not hide an otherwise actionable task
            // when the server cannot be reached.
            return task;
          }
        }))).filter(Boolean);
        if (nextTasks.some(task => !task.leadId)) {
          throw new Error('A lead is missing its ID. Please try again.');
        }
        if (mounted) { setTasks(nextTasks); }
      } catch (error) {
        if (!mounted) { return; }
        if (error?.status === 401) {
          Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onLogout}]);
          return;
        }
        Alert.alert('Unable to load tasks', error?.message || 'Please try again.', [
          {text: 'Cancel', style: 'cancel'}, {text: 'Retry', onPress: loadTasks},
        ]);
      }
    };
    loadTasks();
    return () => { mounted = false; };
  }, [activeTab, selectedTask, onboardingTask, completedLeadIds, onLogout]);
  const openProfile = origin => {
    setProfileOrigin(origin);
    setActiveTab('profile');
  };
  const visibleTasks = useMemo(() => {
    return tasks.filter(task => `${task.name} ${task.contact} ${task.phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [query, tasks]);

  if (selectedTask) {
    return <TaskDetailsScreen fromSalons={activeTab === 'salons'} task={selectedTask} onSessionExpired={onLogout} onBack={() => setSelectedTask(null)} onContinue={openOnboarding} />;
  }

  if (onboardingTask) {
    return <SalonOnboardingScreen salon={onboardingTask} onBack={() => setOnboardingTask(null)} onOnboardingComplete={() => {
      // Submission completes this salon's onboarding task.  Stay in this
      // queue and hide it immediately; Activation is entered through login.
      setCompletedLeadIds(current => current.includes(onboardingTask.leadId)
        ? current : [...current, onboardingTask.leadId]);
      setSelectedTask(null);
      setOnboardingTask(null);
    }} />;
  }

  if (activeTab === 'profile') {
    return (
      <LogoutScreen
        onLogout={onLogout}
        onBack={() => setActiveTab(profileOrigin)}
        bottomBar={(
          <View style={styles.bottomBar}>
            <Pressable onPress={() => setActiveTab('tasks')} style={styles.navItem}><NavIcon type="tasks" /><Text style={styles.navLabel}>Tasks</Text></Pressable>
            <Pressable onPress={() => setActiveTab('salons')} style={styles.navItem}><NavIcon type="salons" /><Text style={styles.navLabel}>Salons</Text></Pressable>
            <Pressable style={[styles.navItem, styles.navItemActive]}><NavIcon type="profile" active /><Text style={[styles.navLabel, styles.navLabelActive]}>Profile</Text></Pressable>
          </View>
        )}
      />
    );
  }

  if (activeTab === 'salons') {
    return <OnboardingSalonsScreen salons={tasks} onTasks={() => setActiveTab('tasks')} onProfile={() => openProfile('salons')} onSelectSalon={setSelectedTask} onOnboard={openOnboarding} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, Platform.OS === 'android' && styles.headerUnderStatusBar]}>
        <View><Text style={styles.title}>Tasks</Text><Text style={styles.subtitle}>All leads assigned to you</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color="#8B90A4" style={styles.searchIcon} /><TextInput value={query} onChangeText={setQuery} placeholder="Search by salon or contact" placeholderTextColor="#A1A5B5" style={styles.searchInput} /></View>
        <View style={styles.taskList}>{visibleTasks.map(task => <TaskCard key={task.leadId} task={task} isLoading={loadingLeadId === task.leadId} onPress={() => setSelectedTask(task)} onOnboard={() => openOnboarding(task)} />)}</View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={[styles.navItem, styles.navItemActive]}><NavIcon type="tasks" active /><Text style={[styles.navLabel, styles.navLabelActive]}>Tasks</Text></Pressable>
        <Pressable onPress={() => setActiveTab('salons')} style={styles.navItem}><NavIcon type="salons" /><Text style={styles.navLabel}>Salons</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => openProfile('tasks')} style={styles.navItem}><NavIcon type="profile" /><Text style={styles.navLabel}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {height: 67, paddingHorizontal: 20, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  headerUnderStatusBar: {height: 67 + (StatusBar.currentHeight || 0), paddingTop: 9 + (StatusBar.currentHeight || 0)},
  title: {color: '#10162E', fontSize: 22, lineHeight: 28, fontFamily: 'Poppins_600SemiBold'},
  subtitle: {color: '#717790', fontSize: 11, marginTop: 1, fontFamily: 'Inter_400Regular'},
  notification: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  notificationIcon: {width: 25, height: 25, tintColor: '#122863'},
  content: {paddingHorizontal: 14, paddingBottom: 20},
  searchBox: {height: 44, borderRadius: 9, borderWidth: 1, borderColor: '#E2E5ED', backgroundColor: '#FAFAFC', flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 14},
  searchIcon: {marginLeft: 12},
  searchInput: {flex: 1, color: '#11172F', fontSize: 11, paddingHorizontal: 8, paddingVertical: 0, fontFamily: 'Inter_400Regular'},
  taskList: {gap: 12},
  taskCard: {height: 145, borderWidth: 1, borderColor: '#E3E6EE', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 10, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: {width: 0, height: 0}, elevation: 0},
  taskCardPressed: {backgroundColor: '#FAFBFF'},
  taskTop: {flexDirection: 'row', alignItems: 'flex-start'},
  shopTile: {width: 34, height: 34, borderRadius: 8, alignItems: 'center', paddingTop: 7},
  awning: {width: 20, height: 7, borderWidth: 1.2, borderTopLeftRadius: 3, borderTopRightRadius: 3, alignItems: 'center', justifyContent: 'center'},
  awningLine: {width: 15, height: 1},
  shopBody: {width: 18, height: 13, borderWidth: 1.2, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end'},
  shopDoor: {width: 5, height: 7},
  taskInfo: {flex: 1, marginLeft: 9, paddingRight: 2},
  taskName: {color: '#141A32', fontSize: 13, fontFamily: 'Poppins_600SemiBold', lineHeight: 17},
  detailRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  detailLine: {color: '#687087', fontSize: 9.5, lineHeight: 15, fontFamily: 'Inter_400Regular'},
  cardFooter: {position: 'absolute', left: 10, right: 10, bottom: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  activity: {color: '#6B48EE', fontSize: 8, fontFamily: 'Inter_400Regular'},
  leadId: {color: '#8A8FA1', fontSize: 7.5, fontFamily: 'Inter_400Regular'},
  actionButton: {position: 'absolute', right: 10, top: 73, height: 28, width: 145, paddingHorizontal: 8, backgroundColor: '#07113D', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  actionText: {color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontFamily: 'Poppins_600SemiBold', textAlign: 'center'},
  actionArrow: {color: '#FFFFFF', fontSize: 20, lineHeight: 20, fontWeight: '300', marginLeft: 5, marginTop: -1},
  pressed: {opacity: 0.86},
  bottomBar: {height: 61, borderTopWidth: 1, borderTopColor: '#E7E9F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 20},
  navItem: {width: 72, height: 51, borderRadius: 5, alignItems: 'center', justifyContent: 'center'},
  navItemActive: {backgroundColor: 'transparent'},
  navIcon: {width: 22, height: 22},
  navLabel: {color: '#71778E', fontSize: 8.5, marginTop: 3, fontFamily: 'Inter_400Regular'},
  navLabelActive: {color: '#3159C8', fontWeight: '600'},
});

export default OnboardingTasksScreen;
