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

const tasksNavIcon = require('../../../assets/icons/onboarding-tasks.png');
const salonsNavIcon = require('../../../assets/icons/onboarding-salons.png');
const profileNavIcon = require('../../../assets/icons/onboarding-profile.png');
const notificationIcon = require('../../../assets/icons/onboarding-notification.png');

const STATUS_COLORS = {
  New: {text: '#5A39EF', background: '#F0EDFF', icon: '#775DFF'},
  'In Progress': {text: '#3477F4', background: '#EAF3FF', icon: '#5C8BFF'},
  'KYC Pending': {text: '#E49322', background: '#FFF3DD', icon: '#F2A83B'},
};

function ShopIcon({color}) {
  return (
    <View style={[styles.shopTile, {backgroundColor: `${color}18`}]}> 
      <View style={[styles.awning, {borderColor: color}]}><View style={[styles.awningLine, {backgroundColor: color}]} /></View>
      <View style={[styles.shopBody, {borderColor: color}]}><View style={[styles.shopDoor, {backgroundColor: color}]} /></View>
    </View>
  );
}

function NavIcon({type, active}) {
  const source = type === 'tasks' ? tasksNavIcon : type === 'salons' ? salonsNavIcon : profileNavIcon;
  return <Image source={source} resizeMode="contain" style={[styles.navIcon, active ? styles.navIconActive : styles.navIconInactive]} />;
}

function SalonCard({salon, onPress, onOnboard}) {
  const palette = STATUS_COLORS[salon.status];
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}>
        <ShopIcon color={palette.icon} />
        <View style={styles.cardInfo}>
          <Text style={styles.salonName}>{salon.name}</Text>
          <Text numberOfLines={1} style={styles.detail}>⌖  {salon.location}</Text>
          <Text style={styles.detail}>♙  {salon.contact}  •  +91 {salon.phone}</Text>
          <Text style={styles.detail}>▣  Assigned on: 12 May 2026</Text>
        </View>
        <View style={[styles.statusPill, {backgroundColor: palette.background}]}><Text style={[styles.statusText, {color: palette.text}]}>{salon.status}</Text></View>
      </View>
      <Pressable onPress={event => { event.stopPropagation(); onOnboard(); }} style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.actionText}>{salon.status === 'New' ? 'Start Onboarding' : 'Continue Onboarding'}</Text><Text style={styles.actionArrow}>›</Text>
      </Pressable>
      <View style={styles.footer}><Text style={styles.distance}>⌁  {salon.activity}</Text><Text style={styles.leadId}>Lead ID: {salon.leadId}</Text></View>
    </Pressable>
  );
}

function OnboardingSalonsScreen({salons, onTasks, onSelectSalon, onOnboard}) {
  const [query, setQuery] = useState('');
  const visibleSalons = useMemo(() => salons.filter(salon => `${salon.name} ${salon.contact} ${salon.phone}`.toLowerCase().includes(query.trim().toLowerCase())), [query, salons]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View><Text style={styles.title}>Salons</Text><Text style={styles.subtitle}>All salons assigned to you</Text></View>
        <Pressable accessibilityLabel="Notifications" style={styles.notification}><Image source={notificationIcon} resizeMode="contain" style={styles.notificationIcon} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search by salon or contact" placeholderTextColor="#A1A5B5" style={styles.searchInput} /></View>
        <View style={styles.list}>{visibleSalons.map(salon => <SalonCard key={salon.leadId} salon={salon} onPress={() => onSelectSalon(salon)} onOnboard={() => onOnboard(salon)} />)}</View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Pressable onPress={onTasks} style={styles.navItem}><NavIcon type="tasks" /><Text style={styles.navLabel}>Tasks</Text></Pressable>
        <Pressable style={[styles.navItem, styles.navItemActive]}><NavIcon type="salons" active /><Text style={[styles.navLabel, styles.navLabelActive]}>Salons</Text></Pressable>
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
  list: {gap: 12},
  card: {height: 145, borderWidth: 1, borderColor: '#E3E6EE', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 10, elevation: 0, shadowOpacity: 0},
  cardPressed: {backgroundColor: '#FAFBFF'},
  cardTop: {flexDirection: 'row', alignItems: 'flex-start'},
  shopTile: {width: 42, height: 42, borderRadius: 8, alignItems: 'center', paddingTop: 8},
  awning: {width: 25, height: 8, borderWidth: 1.5, borderTopLeftRadius: 3, borderTopRightRadius: 3, alignItems: 'center', justifyContent: 'center'},
  awningLine: {width: 19, height: 1.3},
  shopBody: {width: 22, height: 16, borderWidth: 1.5, borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end'},
  shopDoor: {width: 6, height: 9},
  cardInfo: {flex: 1, marginLeft: 10, paddingRight: 3},
  salonName: {color: '#141A32', fontSize: 13, fontWeight: '600', lineHeight: 18},
  detail: {color: '#72788E', fontSize: 8.5, lineHeight: 14},
  statusPill: {height: 20, borderRadius: 7, paddingHorizontal: 7, justifyContent: 'center'},
  statusText: {fontSize: 8, fontWeight: '500'},
  actionButton: {position: 'absolute', right: 10, top: 75, height: 28, width: 137, paddingLeft: 11, paddingRight: 8, backgroundColor: '#07113D', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  actionText: {color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontWeight: '500'},
  actionArrow: {color: '#FFFFFF', fontSize: 20, lineHeight: 20},
  footer: {position: 'absolute', left: 10, right: 10, bottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  distance: {color: '#593EE8', fontSize: 8},
  leadId: {color: '#8A8FA1', fontSize: 7.5},
  pressed: {opacity: 0.86},
  bottomBar: {height: 61, borderTopWidth: 1, borderTopColor: '#E7E9F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 20},
  navItem: {width: 72, height: 51, borderRadius: 5, alignItems: 'center', justifyContent: 'center'},
  navItemActive: {backgroundColor: 'transparent'},
  navIcon: {width: 22, height: 22},
  navIconActive: {tintColor: '#3159C8'},
  navIconInactive: {tintColor: '#71778E'},
  navLabel: {color: '#71778E', fontSize: 8.5, marginTop: 3},
  navLabelActive: {color: '#3159C8', fontWeight: '600'},
});

export default OnboardingSalonsScreen;
