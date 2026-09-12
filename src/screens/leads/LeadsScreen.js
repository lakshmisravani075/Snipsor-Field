import React, {useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LeadDetailsScreen from './LeadDetailsScreen.js';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import {leadService} from '../../services/apiService.js';

const extractLeads = response => {
  const candidates = [
    response,
    response?.data,
    response?.leads,
    response?.items,
    response?.results,
    response?.rows,
    response?.data?.leads,
    response?.data?.items,
    response?.data?.results,
    response?.data?.rows,
  ];
  return candidates.find(Array.isArray) || [];
};

const normalizeStatus = value => {
  const status = String(value || '').toUpperCase().replace(/[ -]+/g, '_');
  if (status === 'FOLLOW_UP') {
    return 'Follow-up';
  }
  if (status === 'NOT_INTERESTED') {
    return 'Not Interested';
  }
  return status === 'INTERESTED' ? 'Interested' : String(value || '');
};

const formatFollowUp = value => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const today = new Date();
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) {
    return 'Today';
  }
  return date.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'});
};

const normalizeLead = lead => ({
  ...lead,
  id: lead.id || lead.lead_id || lead.leadId,
  name: lead.salon_name || lead.salonName || '',
  location: lead.address || lead.complete_address || lead.completeAddress || '',
  pincode: lead.pincode || lead.pin_code || lead.postcode || lead.postal_code || lead.postalCode || '',
  person: lead.contact_person || lead.contactPerson || lead.contact_person_name || lead.contactPersonName || '',
  phone: lead.phone_number || lead.phoneNumber || '',
  whatsapp: lead.whatsapp_number || lead.whatsappNumber || '',
  email: lead.email || lead.contact_email || lead.contactEmail || '',
  notes: lead.follow_up_note || lead.followUpNote || lead.follow_up_notes || lead.note || lead.notes || lead.acquisition?.follow_up_note || lead.acquisition?.note || '',
  createdAt: lead.created_at || lead.createdAt || '',
  followup: formatFollowUp(lead.follow_up_date || lead.followUpDate),
  status: normalizeStatus(lead.status),
  color: '#FF5B3E',
});

function ShopIcon({color}) {
  return <View style={[styles.shopIcon, {backgroundColor: `${color}16`}]}><Ionicons name="storefront-outline" size={23} color={color} /></View>;
}

function PersonIcon({color}) { return <Ionicons name="person-outline" size={22} color={color} />; }

function AddLeadIcon({color = '#707797'}) { return <Ionicons name="person-add-outline" size={22} color={color} />; }

function LeadCard({lead, onPress}) {
  const background = lead.status === 'Interested' ? '#DDF9E8' : lead.status === 'Follow-up' ? '#FFF0EA' : '#E8F2FF';
  const dueToday = lead.followup === 'Today';
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
      <ShopIcon color={lead.color} />
      <View style={styles.details}>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.location}>{lead.location}</Text>
        <View style={styles.contactRow}><Text style={styles.person}>{lead.person}</Text><Text style={styles.dot}>•</Text><Text style={styles.phone}>{lead.phone}</Text></View>
        <View style={styles.followupRow}><Ionicons name="calendar-outline" size={12} color={dueToday ? '#FF4D34' : '#5C43F3'} /><Text style={[styles.followup, dueToday && styles.dueToday]}>Next follow-up: {lead.followup}</Text></View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.status, {backgroundColor: background}]}><Text style={[styles.statusText, {color: lead.color}]}>{lead.status}</Text></View>
        <Ionicons name="chevron-forward" size={19} color="#18245C" />
      </View>
    </Pressable>
  );
}

function LeadsScreen({onAddLead, onProfile, onSessionExpired}) {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    let isMounted = true;
    const loadLeads = async () => {
      try {
        const response = await leadService.getLeads();
        if (isMounted) {
          setLeads(extractLeads(response).map(normalizeLead));
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        if (error?.status === 401) {
          Alert.alert('Session expired', 'Please log in again to continue.', [{text: 'OK', onPress: onSessionExpired}]);
          return;
        }
        Alert.alert('Unable to load leads', error?.message || 'Please try again.');
      }
    };
    loadLeads();
    return () => {
      isMounted = false;
    };
  }, [onSessionExpired]);

  const normalizedQuery = String(searchQuery ?? '').trim().toLowerCase();
  const followUpLeads = leads.filter(lead => lead.status === 'Follow-up');
  const visibleLeads = followUpLeads.filter(lead => {
    const matchesQuery = `${lead.name} ${lead.location} ${lead.person} ${lead.phone}`.toLowerCase().includes(normalizedQuery);
    return matchesQuery;
  });

  if (selectedLead) {
    return (
      <LeadDetailsScreen
        lead={selectedLead}
        onBack={() => setSelectedLead(null)}
        onSessionExpired={onSessionExpired}
        onStatusUpdated={(leadId, status, updatedRecord) => {
          setLeads(currentLeads => currentLeads.map(item => {
            if (String(item.id) !== String(leadId)) {
              return item;
            }
            const responseLead = updatedRecord && typeof updatedRecord === 'object'
              ? normalizeLead({...item, ...updatedRecord})
              : item;
            return {...responseLead, status: normalizeStatus(status)};
          }));
          setSelectedLead(current => {
            if (!current) {
              return current;
            }
            const responseLead = updatedRecord && typeof updatedRecord === 'object'
              ? normalizeLead({...current, ...updatedRecord})
              : current;
            return {...responseLead, status: normalizeStatus(status)};
          });
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Text style={styles.brand}>Snipsor <Text style={styles.brandAccent}>Field</Text></Text>
        <Text style={styles.greeting}>Good morning, Priya 👋</Text>
        <Text style={styles.subtitle}>Let's close more salons today</Text>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#334078" style={styles.inputSearchIcon} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search leads..." placeholderTextColor="#777D9B" style={styles.searchInput} />
        </View>
      </View>

      <View style={styles.filterArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Pressable style={[styles.filterPill, styles.activeFilter, styles.followupFilter]}>
            <Text style={[styles.filterText, styles.activeFilterText, styles.followupFilterText]}>Follow-up ({followUpLeads.length})</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.activeLine} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {visibleLeads.map((lead, index) => <LeadCard key={lead.id || lead.phone || index} lead={lead} onPress={() => setSelectedLead(lead)} />)}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.navItem}><PersonIcon color="#4D32F4" /><Text style={[styles.navLabel, styles.navActive]}>Leads</Text></Pressable>
        <Pressable onPress={onAddLead} style={styles.navItem}><AddLeadIcon /><Text style={styles.navLabel}>Add Lead</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onProfile} style={styles.navItem}><PersonIcon color="#707797" /><Text style={styles.navLabel}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 121, backgroundColor: '#07113D', paddingHorizontal: 12, paddingTop: 8},
  brand: {color: '#FFFFFF', fontSize: 17, fontWeight: '400', letterSpacing: -0.4},
  brandAccent: {color: '#654CFF'},
  greeting: {color: '#FFFFFF', fontSize: 14, fontFamily: 'Poppins_600SemiBold', lineHeight: 19, marginTop: 20},
  subtitle: {color: '#D4D8E8', fontSize: 9, lineHeight: 14, marginTop: 2, fontFamily: 'Inter_400Regular'},
  searchArea: {backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingTop: 12, paddingBottom: 10}, searchBox: {height: 42, borderWidth: 1.3, borderColor: '#5E67FF', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center'}, searchInput: {flex: 1, height: '100%', color: '#10183D', fontSize: 13, paddingHorizontal: 10, paddingVertical: 0, fontFamily: 'Inter_400Regular'}, inputSearchIcon: {marginLeft: 11},
  filterArea: {height: 49, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECEEF4'},
  filters: {alignItems: 'center', gap: 8, paddingHorizontal: 11}, filterPill: {height: 25, borderRadius: 12, backgroundColor: '#F1F2F6', paddingHorizontal: 10, justifyContent: 'center'}, activeFilter: {backgroundColor: '#F0EEFF'}, followupFilter: {backgroundColor: '#FFF0EA'}, filterText: {fontSize: 10, color: '#303858', fontWeight: '400'}, activeFilterText: {color: '#4D32F4'}, followupFilterText: {color: '#FF5B3E'}, activeLine: {position: 'absolute', bottom: 0, left: 13, width: 39, height: 2, borderRadius: 1, backgroundColor: '#4D32F4'},
  list: {paddingHorizontal: 15, paddingTop: 9, paddingBottom: 75, gap: 10},
  card: {minHeight: 135, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E6F0', paddingHorizontal: 13, paddingVertical: 18, flexDirection: 'row'}, cardPressed: {opacity: 0.9},
  shopIcon: {width: 38, height: 38, borderRadius: 9, alignItems: 'center', paddingTop: 8}, awning: {width: 22, height: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3}, shopBody: {width: 20, height: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'flex-end'}, shopDoor: {width: 5, height: 9},
  details: {flex: 1, marginLeft: 10}, name: {color: '#11183A', fontSize: 14.5, fontFamily: 'Poppins_600SemiBold'}, location: {color: '#626986', fontSize: 11, marginTop: 3, fontFamily: 'Inter_400Regular'}, contactRow: {flexDirection: 'row', alignItems: 'center', marginTop: 6}, person: {color: '#454D6C', fontSize: 11, fontFamily: 'Inter_400Regular'}, dot: {color: '#9198AF', fontSize: 10, marginHorizontal: 4}, phone: {color: '#1D285C', fontSize: 11, fontFamily: 'Inter_400Regular'}, followupRow: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7}, followup: {color: '#56607F', fontSize: 11, fontFamily: 'Inter_400Regular'}, dueToday: {color: '#FF4D34'},
  cardRight: {alignItems: 'flex-end', justifyContent: 'space-between'}, status: {height: 21, borderRadius: 5, justifyContent: 'center', paddingHorizontal: 8}, statusText: {fontSize: 10.5, fontFamily: 'Inter_400Regular'}, chevron: {color: '#18245C', fontSize: 23, lineHeight: 23},
  bottomBar: {height: 61, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E7E9F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 42}, navItem: {width: 64, alignItems: 'center'}, navLabel: {color: '#707797', fontSize: 9, marginTop: 3, fontFamily: 'Inter_400Regular'}, navActive: {color: '#4D32F4'},
  addLeadIcon: {width: 20, height: 20, borderRadius: 10, borderWidth: 1.7, alignItems: 'center', justifyContent: 'center'}, addLeadLine: {position: 'absolute', width: 10, height: 1.7, borderRadius: 1}, addLeadLineVertical: {transform: [{rotate: '90deg'}]},
  personIcon: {width: 22, height: 22, alignItems: 'center'}, personHead: {width: 9, height: 9, borderRadius: 5}, personBody: {width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginTop: 2},
});

export default LeadsScreen;
