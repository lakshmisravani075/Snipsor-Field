import React, {useMemo, useState} from 'react';
import {
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
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import {formatAssignedOn} from '../onboardingTasks.js';

const STATUS_COLORS = {
  New: {text: '#5A39EF', background: '#F0EDFF', icon: '#775DFF'},
  'In Progress': {text: '#3477F4', background: '#EAF3FF', icon: '#5C8BFF'},
  'KYC Pending': {text: '#E49322', background: '#FFF3DD', icon: '#F2A83B'},
};

function ShopIcon({color}) {
  return <View style={[styles.shopTile, {backgroundColor: `${color}18`}]}><Ionicons name="storefront-outline" size={25} color={color} /></View>;
}

function NavIcon({type, active}) {
  const color = active ? '#3159C8' : '#71778E';
  const name = type === 'tasks' ? 'clipboard-outline' : type === 'salons' ? 'storefront-outline' : 'person-outline';
  return <Ionicons name={name} size={22} color={color} />;
}

function SalonCard({salon, onPress, onOnboard}) {
  const palette = STATUS_COLORS[salon.status];
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}>
        <ShopIcon color={palette.icon} />
        <View style={styles.cardInfo}>
          <Text style={styles.salonName}>{salon.name}</Text>
          <View style={styles.detailRow}><Ionicons name="location-outline" size={10} color="#72788E" /><Text numberOfLines={1} style={styles.detail}>{salon.location}</Text></View>
          <View style={styles.detailRow}><Ionicons name="person-outline" size={10} color="#72788E" /><Text style={styles.detail}>{salon.contact}  •  +91 {salon.phone}</Text></View>
          <View style={styles.detailRow}><Ionicons name="calendar-outline" size={10} color="#72788E" /><Text style={styles.detail}>{salon.assignedOn ? `Assigned on: ${formatAssignedOn(salon.assignedOn)}` : 'Assignment pending'}</Text></View>
        </View>
        <View style={[styles.statusPill, {backgroundColor: palette.background}]}><Text style={[styles.statusText, {color: palette.text}]}>{salon.status}</Text></View>
      </View>
      <Pressable onPress={event => { event.stopPropagation(); onOnboard(); }} style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.actionText}>{salon.status === 'New' ? 'Start Onboarding' : 'Continue Onboarding'}</Text>
      </Pressable>
      <View style={styles.footer}><View style={styles.detailRow}><Ionicons name="navigate-outline" size={9} color="#593EE8" /><Text style={styles.distance}>{salon.activity}</Text></View><Text style={styles.leadId}>Lead ID: {salon.leadId}</Text></View>
    </Pressable>
  );
}

function OnboardingSalonsScreen({salons, onTasks, onProfile, onSelectSalon, onOnboard}) {
  const [query, setQuery] = useState('');
  const visibleSalons = useMemo(() => salons.filter(salon => `${salon.name} ${salon.contact} ${salon.phone}`.toLowerCase().includes(query.trim().toLowerCase())), [query, salons]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, Platform.OS === 'android' && styles.headerUnderStatusBar]}>
        <View><Text style={styles.title}>Salons</Text><Text style={styles.subtitle}>All salons assigned to you</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color="#8B90A4" style={styles.searchIcon} /><TextInput value={query} onChangeText={setQuery} placeholder="Search by salon or contact" placeholderTextColor="#A1A5B5" style={styles.searchInput} /></View>
        <View style={styles.list}>{visibleSalons.map(salon => <SalonCard key={salon.leadId} salon={salon} onPress={() => onSelectSalon(salon)} onOnboard={() => onOnboard(salon)} />)}</View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Pressable onPress={onTasks} style={styles.navItem}><NavIcon type="tasks" /><Text style={styles.navLabel}>Tasks</Text></Pressable>
        <Pressable style={[styles.navItem, styles.navItemActive]}><NavIcon type="salons" active /><Text style={[styles.navLabel, styles.navLabelActive]}>Salons</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onProfile} style={styles.navItem}><NavIcon type="profile" /><Text style={styles.navLabel}>Profile</Text></Pressable>
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
  salonName: {color: '#141A32', fontSize: 13, fontFamily: 'Poppins_600SemiBold', lineHeight: 18},
  detailRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  detail: {color: '#72788E', fontSize: 8.5, lineHeight: 14, fontFamily: 'Inter_400Regular'},
  statusPill: {height: 20, borderRadius: 7, paddingHorizontal: 7, justifyContent: 'center'},
  statusText: {fontSize: 8, fontFamily: 'Inter_500Medium'},
  actionButton: {position: 'absolute', right: 10, top: 75, height: 28, width: 145, paddingHorizontal: 8, backgroundColor: '#07113D', borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  actionText: {color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontFamily: 'Poppins_600SemiBold', textAlign: 'center'},
  actionArrow: {color: '#FFFFFF', fontSize: 20, lineHeight: 20},
  footer: {position: 'absolute', left: 10, right: 10, bottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  distance: {color: '#593EE8', fontSize: 8, fontFamily: 'Inter_400Regular'},
  leadId: {color: '#8A8FA1', fontSize: 7.5, fontFamily: 'Inter_400Regular'},
  pressed: {opacity: 0.86},
  bottomBar: {height: 61, borderTopWidth: 1, borderTopColor: '#E7E9F0', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 20},
  navItem: {width: 72, height: 51, borderRadius: 5, alignItems: 'center', justifyContent: 'center'},
  navItemActive: {backgroundColor: 'transparent'},
  navIcon: {width: 22, height: 22},
  navIconActive: {tintColor: '#3159C8'},
  navIconInactive: {tintColor: '#71778E'},
  navLabel: {color: '#71778E', fontSize: 8.5, marginTop: 3, fontFamily: 'Inter_400Regular'},
  navLabelActive: {color: '#3159C8', fontWeight: '600'},
});

export default OnboardingSalonsScreen;
