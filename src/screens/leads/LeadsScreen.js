import React, {useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LeadDetailsScreen from './LeadDetailsScreen.js';

const FILTERS = ['All (124)', 'New (48)', 'Interested (38)', 'Follow-up (12)'];
const LEADS = [
  {name: 'Royal Salon', location: 'Kukatpally, Hyderabad', person: 'Ramesh Kumar', phone: '9876543210', followup: '28 Aug 2026', status: 'Interested', color: '#20B967'},
  {name: 'Urban Salon', location: 'Madhapur, Hyderabad', person: 'Suresh Reddy', phone: '9876543211', followup: 'Today', status: 'Follow-up', color: '#FF5B3E'},
  {name: 'Glam Studio', location: 'Ameerpet, Hyderabad', person: 'Neha Agarwal', phone: '9876543214', followup: '27 Aug 2026', status: 'New', color: '#1C7CFF'},
  {name: 'Cut & Style', location: 'Hitech City, Hyderabad', person: 'Arjun Patel', phone: '9876543215', followup: '29 Aug 2026', status: 'Interested', color: '#20B967'},
  {name: 'Trendy Salon', location: 'Secunderabad, Hyderabad', person: 'Imran Khan', phone: '9876543216', followup: 'Today', status: 'Follow-up', color: '#FF5B3E'},
  {name: 'Shine Salon', location: 'Dilsukhnagar, Hyderabad', person: 'Manoj Kumar', phone: '9876543217', followup: '28 Aug 2026', status: 'New', color: '#14B8C8'},
];

function ShopIcon({color}) {
  return (
    <View style={[styles.shopIcon, {backgroundColor: `${color}16`}]}> 
      <View style={[styles.awning, {backgroundColor: color}]} />
      <View style={[styles.shopBody, {borderColor: color}]}><View style={[styles.shopDoor, {backgroundColor: color}]} /></View>
    </View>
  );
}

function PersonIcon({color}) {
  return <View style={styles.personIcon}><View style={[styles.personHead, {backgroundColor: color}]} /><View style={[styles.personBody, {backgroundColor: color}]} /></View>;
}

function HomeIcon({color}) {
  return <View style={styles.homeIcon}><View style={[styles.homeRoof, {backgroundColor: color}]} /><View style={[styles.homeBody, {backgroundColor: color}]}><View style={styles.homeDoor} /></View></View>;
}

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
        <View style={styles.followupRow}><Text style={[styles.calendar, dueToday && styles.dueToday]}>▣</Text><Text style={[styles.followup, dueToday && styles.dueToday]}>Next follow-up: {lead.followup}</Text></View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.status, {backgroundColor: background}]}><Text style={[styles.statusText, {color: lead.color}]}>{lead.status}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

function LeadsScreen({onHome}) {
  const [activeFilter, setActiveFilter] = useState(0);
  const [selectedLead, setSelectedLead] = useState(null);

  if (selectedLead) {
    return <LeadDetailsScreen lead={selectedLead} onBack={() => setSelectedLead(null)} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Open menu" style={styles.menu}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></Pressable>
        <Text style={styles.title}>Leads</Text>
        <Text style={styles.headerSearch}>⌕</Text>
      </View>

      <View style={styles.filterArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter, index) => (
            <Pressable key={filter} onPress={() => setActiveFilter(index)} style={[styles.filterPill, index === activeFilter && styles.activeFilter, index === 3 && styles.followupFilter]}>
              <Text style={[styles.filterText, index === activeFilter && styles.activeFilterText, index === 3 && styles.followupFilterText]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.activeLine} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {LEADS.map(lead => <LeadCard key={lead.phone} lead={lead} onPress={() => setSelectedLead(lead)} />)}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable onPress={onHome} style={styles.navItem}><HomeIcon color="#707797" /><Text style={styles.navLabel}>Home</Text></Pressable>
        <Pressable style={styles.navItem}><PersonIcon color="#4D32F4" /><Text style={[styles.navLabel, styles.navActive]}>Leads</Text></Pressable>
        <Pressable style={styles.fab}><Text style={styles.fabText}>＋</Text></Pressable>
        <Pressable style={styles.navItem}><View style={styles.activityIcon}><View style={styles.activityBar} /><View style={styles.activityBar} /><View style={styles.activityBar} /></View><Text style={styles.navLabel}>Activity</Text></Pressable>
        <Pressable style={styles.navItem}><PersonIcon color="#707797" /><Text style={styles.navLabel}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 90, backgroundColor: '#07113D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13},
  menu: {width: 24, height: 24, justifyContent: 'center', gap: 4}, menuLine: {width: 15, height: 1.5, borderRadius: 1, backgroundColor: '#FFFFFF'},
  title: {color: '#FFFFFF', fontSize: 18, fontWeight: '400', marginLeft: 8}, headerSearch: {color: '#FFFFFF', fontSize: 27, marginLeft: 'auto', transform: [{rotate: '-20deg'}]},
  filterArea: {height: 49, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECEEF4'},
  filters: {alignItems: 'center', gap: 8, paddingHorizontal: 11}, filterPill: {height: 25, borderRadius: 12, backgroundColor: '#F1F2F6', paddingHorizontal: 10, justifyContent: 'center'}, activeFilter: {backgroundColor: '#F0EEFF'}, followupFilter: {backgroundColor: '#FFF0EA'}, filterText: {fontSize: 10, color: '#303858', fontWeight: '400'}, activeFilterText: {color: '#4D32F4'}, followupFilterText: {color: '#FF5B3E'}, activeLine: {position: 'absolute', bottom: 0, left: 13, width: 39, height: 2, borderRadius: 1, backgroundColor: '#4D32F4'},
  list: {paddingHorizontal: 7, paddingTop: 9, paddingBottom: 75, gap: 10},
  card: {minHeight: 135, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E6F0', paddingHorizontal: 13, paddingVertical: 18, flexDirection: 'row', shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.1, shadowRadius: 7, elevation: 4}, cardPressed: {opacity: 0.9},
  shopIcon: {width: 38, height: 38, borderRadius: 9, alignItems: 'center', paddingTop: 8}, awning: {width: 22, height: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3}, shopBody: {width: 20, height: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'flex-end'}, shopDoor: {width: 5, height: 9},
  details: {flex: 1, marginLeft: 10}, name: {color: '#11183A', fontSize: 14.5, fontWeight: '400'}, location: {color: '#626986', fontSize: 11, marginTop: 3}, contactRow: {flexDirection: 'row', alignItems: 'center', marginTop: 6}, person: {color: '#454D6C', fontSize: 11, fontWeight: '400'}, dot: {color: '#9198AF', fontSize: 10, marginHorizontal: 4}, phone: {color: '#1D285C', fontSize: 11, fontWeight: '400'}, followupRow: {flexDirection: 'row', alignItems: 'center', marginTop: 7}, calendar: {color: '#5C43F3', fontSize: 11, marginRight: 5}, followup: {color: '#56607F', fontSize: 11}, dueToday: {color: '#FF4D34'},
  cardRight: {alignItems: 'flex-end', justifyContent: 'space-between'}, status: {height: 21, borderRadius: 5, justifyContent: 'center', paddingHorizontal: 8}, statusText: {fontSize: 10.5, fontWeight: '400'}, chevron: {color: '#18245C', fontSize: 23, lineHeight: 23},
  bottomBar: {height: 61, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E7E9F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'}, navItem: {width: 54, alignItems: 'center'}, navLabel: {color: '#707797', fontSize: 9, marginTop: 3, fontWeight: '400'}, navActive: {color: '#4D32F4'},
  personIcon: {width: 22, height: 22, alignItems: 'center'}, personHead: {width: 9, height: 9, borderRadius: 5}, personBody: {width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginTop: 2},
  homeIcon: {width: 22, height: 22, position: 'relative', alignItems: 'center', justifyContent: 'flex-end'}, homeRoof: {position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 2, transform: [{rotate: '45deg'}]}, homeBody: {width: 18, height: 14, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, alignItems: 'center', justifyContent: 'flex-end'}, homeDoor: {width: 5, height: 8, backgroundColor: '#FFFFFF', borderTopLeftRadius: 1, borderTopRightRadius: 1},
  fab: {width: 42, height: 42, borderRadius: 21, backgroundColor: '#4E32F4', marginTop: -20, alignItems: 'center', justifyContent: 'center', shadowColor: '#4E32F4', shadowOpacity: 0.35, shadowRadius: 5, elevation: 6}, fabText: {color: '#FFFFFF', fontSize: 26, fontWeight: '400', marginTop: -2}, activityIcon: {height: 20, flexDirection: 'row', alignItems: 'center', gap: 2}, activityBar: {width: 5, height: 18, borderRadius: 2, backgroundColor: '#41516C'},
});

export default LeadsScreen;
