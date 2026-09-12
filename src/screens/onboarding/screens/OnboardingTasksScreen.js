import React, {useMemo, useState} from 'react';
import {
  Image,
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

const tasksNavIcon = require('../../../assets/icons/onboarding-tasks.png');
const salonsNavIcon = require('../../../assets/icons/onboarding-salons.png');
const profileNavIcon = require('../../../assets/icons/onboarding-profile.png');
const notificationIcon = require('../../../assets/icons/onboarding-notification.png');

const TASKS = [
  {name: 'Hair & Beyond', location: 'Tirupati, Andhra Pradesh', contact: 'Meena Reddy', phone: '98765 43210', assignee: 'Maya Joshi', status: 'New', activity: '2.4 hrs away', leadId: 'LD-2026-452'},
  {name: 'Looks Studio', location: 'Punganoor, Andhra Pradesh', contact: 'Ravi Kumar', phone: '91823 56789', assignee: 'Maya Joshi', status: 'In Progress', onboardingStep: 4, activity: '5.8 hrs away', leadId: 'LD-2026-448'},
  {name: 'Style Lounge', location: 'Rajampet, Andhra Pradesh', contact: 'Suresh Babu', phone: '90123 45678', assignee: 'Maya Joshi', status: 'KYC Pending', onboardingStep: 8, activity: '6.1 hrs away', leadId: 'LD-2026-443'},
  {name: 'Urban Cuts', location: 'Palamaner, Andhra Pradesh', contact: 'Anil Yadav', phone: '95000 98765', assignee: 'Maya Joshi', status: 'In Progress', onboardingStep: 6, activity: '6.8 hrs away', leadId: 'LD-2026-438'},
  {name: 'The Men’s Point', location: 'Chittoor, Andhra Pradesh', contact: 'Venkatesh', phone: '98887 65432', assignee: 'Maya Joshi', status: 'New', activity: 'Yesterday', leadId: 'LD-2026-431'},
];

const STATUS_COLORS = {
  New: {text: '#5A39EF', background: '#F0EDFF', icon: '#775DFF'},
  'In Progress': {text: '#3477F4', background: '#EAF3FF', icon: '#5C8BFF'},
  'KYC Pending': {text: '#E49322', background: '#FFF3DD', icon: '#F2A83B'},
};

function ShopIcon({color}) {
  return (
    <View style={[styles.shopTile, {backgroundColor: `${color}18`}]}> 
      <View style={[styles.awning, {borderColor: color}]}>
        <View style={[styles.awningLine, {backgroundColor: color}]} />
      </View>
      <View style={[styles.shopBody, {borderColor: color}]}>
        <View style={[styles.shopDoor, {backgroundColor: color}]} />
      </View>
    </View>
  );
}

function TaskCard({task, onPress, onOnboard}) {
  const palette = STATUS_COLORS[task.status];
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.taskCard, pressed && styles.taskCardPressed]}>
      <View style={styles.taskTop}>
        <ShopIcon color={palette.icon} />
        <View style={styles.taskInfo}>
          <Text style={styles.taskName}>{task.name}</Text>
          <Text numberOfLines={1} style={styles.detailLine}>⌖  {task.location}</Text>
          <Text style={styles.detailLine}>♙  {task.contact}  •  {task.phone}</Text>
          <Text style={styles.detailLine}>▣  Assigned to: {task.assignee}</Text>
        </View>
      </View>
      <Pressable onPress={event => { event.stopPropagation(); onOnboard(); }} style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.actionText}>{task.status === 'New' ? 'Start Onboarding' : 'Continue Onboarding'}</Text>
        <Text style={styles.actionArrow}>›</Text>
      </Pressable>
      <View style={styles.cardFooter}>
        <Text style={styles.activity}>⌁  {task.activity}</Text>
        <Text style={styles.leadId}>Lead ID: {task.leadId}</Text>
      </View>
    </Pressable>
  );
}

function NavIcon({type, active}) {
  const color = active ? '#3159C8' : '#71778E';
  const source = type === 'tasks'
    ? tasksNavIcon
    : type === 'salons'
      ? salonsNavIcon
      : profileNavIcon;

  return <Image source={source} resizeMode="contain" style={[styles.navIcon, {tintColor: color}]} />;
}

function OnboardingTasksScreen() {
  const [query, setQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [onboardingTask, setOnboardingTask] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const visibleTasks = useMemo(() => {
    return TASKS.filter(task => `${task.name} ${task.contact} ${task.phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [query]);

  if (selectedTask) {
    return <TaskDetailsScreen task={selectedTask} onBack={() => setSelectedTask(null)} onContinue={() => {setOnboardingTask(selectedTask); setSelectedTask(null);}} />;
  }

  if (onboardingTask) {
    return <SalonOnboardingScreen salon={onboardingTask} onBack={() => setOnboardingTask(null)} />;
  }

  if (activeTab === 'salons') {
    return <OnboardingSalonsScreen salons={TASKS} onTasks={() => setActiveTab('tasks')} onSelectSalon={setSelectedTask} onOnboard={setOnboardingTask} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View><Text style={styles.title}>Tasks</Text><Text style={styles.subtitle}>All leads assigned to you</Text></View>
        <Pressable accessibilityLabel="Notifications" style={styles.notification}><Image source={notificationIcon} resizeMode="contain" style={styles.notificationIcon} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search by salon or contact" placeholderTextColor="#A1A5B5" style={styles.searchInput} /></View>
        <View style={styles.taskList}>{visibleTasks.map(task => <TaskCard key={task.leadId} task={task} onPress={() => setSelectedTask(task)} onOnboard={() => setOnboardingTask(task)} />)}</View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={[styles.navItem, styles.navItemActive]}><NavIcon type="tasks" active /><Text style={[styles.navLabel, styles.navLabelActive]}>Tasks</Text></Pressable>
        <Pressable onPress={() => setActiveTab('salons')} style={styles.navItem}><NavIcon type="salons" /><Text style={styles.navLabel}>Salons</Text></Pressable>
        <Pressable style={styles.navItem}><NavIcon type="profile" /><Text style={styles.navLabel}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {height: 67, paddingHorizontal: 20, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  title: {color: '#10162E', fontSize: 22, lineHeight: 28, fontWeight: '600'},
  subtitle: {color: '#717790', fontSize: 11, marginTop: 1},
  notification: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  notificationIcon: {width: 25, height: 25, tintColor: '#122863'},
  content: {paddingHorizontal: 14, paddingBottom: 20},
  searchBox: {height: 44, borderRadius: 9, borderWidth: 1, borderColor: '#E2E5ED', backgroundColor: '#FAFAFC', flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 14},
  searchIcon: {fontSize: 22, color: '#8B90A4', marginLeft: 12, transform: [{rotate: '-20deg'}]},
  searchInput: {flex: 1, color: '#11172F', fontSize: 11, paddingHorizontal: 8, paddingVertical: 0},
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
  taskName: {color: '#141A32', fontSize: 13, fontWeight: '500', lineHeight: 17},
  detailLine: {color: '#687087', fontSize: 9.5, lineHeight: 15},
  cardFooter: {position: 'absolute', left: 10, right: 10, bottom: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  activity: {color: '#6B48EE', fontSize: 8},
  leadId: {color: '#8A8FA1', fontSize: 7.5},
  actionButton: {position: 'absolute', right: 10, top: 73, height: 28, width: 137, paddingLeft: 11, paddingRight: 8, backgroundColor: '#07113D', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  actionText: {color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontWeight: '500'},
  actionArrow: {color: '#FFFFFF', fontSize: 20, lineHeight: 20, fontWeight: '300', marginLeft: 5, marginTop: -1},
  pressed: {opacity: 0.86},
  bottomBar: {height: 61, borderTopWidth: 1, borderTopColor: '#E7E9F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 20},
  navItem: {width: 72, height: 51, borderRadius: 5, alignItems: 'center', justifyContent: 'center'},
  navItemActive: {backgroundColor: 'transparent'},
  navIcon: {width: 22, height: 22},
  navLabel: {color: '#71778E', fontSize: 8.5, marginTop: 3},
  navLabelActive: {color: '#3159C8', fontWeight: '600'},
});

export default OnboardingTasksScreen;
