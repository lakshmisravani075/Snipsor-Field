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
import LeadsScreen from '../leads/LeadsScreen.js';
import AddLeadScreen from '../leads/AddLeadScreen.js';

const teamLeadsIcon = require('../../assets/icons/team-leads.png');
const interestedLeadsIcon = require('../../assets/icons/interested-leads.png');
const followUpLeadsIcon = require('../../assets/icons/follow-up-leads.png');
const filterIcon = require('../../assets/icons/filter.png');

const LEADS = [
  {name: 'Royal Salon', owner: 'Kukatpally, Hyderabad', person: 'Ramesh Kumar', phone: '9876543210', status: 'Interested', color: '#20B967'},
  {name: 'Urban Salon', owner: 'Madhapur, Hyderabad', person: 'Suresh Reddy', phone: '9876543211', status: 'Follow-up', color: '#FF5B3E'},
  {name: "Jaya's Salon", owner: 'KPHB, Hyderabad', person: 'Jagan Mohan', phone: '9876543212', status: 'New', color: '#1C7CFF'},
  {name: 'Looks Salon', owner: 'Banjara Hills, Hyderabad', person: 'Vikas Sharma', phone: '9876543213', status: 'Not Interested', color: '#152044'},
];

const FILTERS = ['All (124)', 'New (48)', 'Interested (38)', 'Follow-up (12)'];

function LineIcon({type, color = '#41516C', size = 22}) {
  if (type === 'home') {
    return <View style={[styles.homeIcon, {width: size, height: size}]}><View style={[styles.homeRoof, {backgroundColor: color}]} /><View style={[styles.homeBody, {backgroundColor: color}]}><View style={styles.homeDoor} /></View></View>;
  }
  if (type === 'person') {
    return <View style={{width: size, height: size, alignItems: 'center'}}><View style={[styles.personHead, {backgroundColor: color}]} /><View style={[styles.personBody, {backgroundColor: color}]} /></View>;
  }
  return <Text style={{color, fontSize: size, fontWeight: '400'}}>{type}</Text>;
}

function PeopleIcon({color, grouped = false}) {
  return (
    <View style={styles.peopleIcon}>
      {grouped && <View style={[styles.sideHead, styles.sideHeadLeft, {borderColor: color}]} />}
      {grouped && <View style={[styles.sideHead, styles.sideHeadRight, {borderColor: color}]} />}
      <View style={[styles.mainHead, {borderColor: color}]} />
      <View style={[styles.mainBody, {borderColor: color}]} />
      {grouped && <View style={[styles.groupBase, {borderColor: color}]} />}
    </View>
  );
}

function StatCard({iconColor, iconBackground, value, label, grouped, imageSource}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, {backgroundColor: iconBackground}]}>
        {imageSource ? (
          <Image source={imageSource} resizeMode="contain" style={styles.statImage} />
        ) : (
          <PeopleIcon color={iconColor} grouped={grouped} />
        )}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LeadCard({lead, index}) {
  const statusBackground = lead.status === 'Interested' ? '#DDF9E8' : lead.status === 'Follow-up' ? '#FFF0EA' : lead.status === 'New' ? '#E8F2FF' : '#EFF1F6';
  return (
    <View style={styles.leadCard}>
      <View style={[styles.shopIcon, {backgroundColor: `${lead.color}16`}]}>
        <View style={[styles.awning, {backgroundColor: lead.color}]} />
        <View style={[styles.shopBody, {borderColor: lead.color}]}><View style={[styles.shopDoor, {backgroundColor: lead.color}]} /></View>
      </View>
      <View style={styles.leadDetails}>
        <Text style={styles.leadName}>{lead.name}</Text>
        <Text style={styles.leadLocation}>{lead.owner}</Text>
        <View style={styles.contactRow}>
          <Text style={styles.contactName}>{lead.person}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.contactPhone}>{lead.phone}</Text>
        </View>
        <View style={styles.nextFollowup}><Text style={[styles.calendar, lead.status === 'Follow-up' && styles.followupDue]}>▣</Text><Text style={[styles.followupText, lead.status === 'Follow-up' && styles.followupDue]}>{lead.status === 'Follow-up' ? 'Next follow-up: Today' : 'Next follow-up: 28 Aug 2026'}</Text></View>
      </View>
      <View style={styles.leadRight}>
        <View style={[styles.statusPill, {backgroundColor: statusBackground}]}><Text style={[styles.statusText, {color: lead.color}]}>{lead.status}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </View>
  );
}

function HomeScreen() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(0);
  const [activeScreen, setActiveScreen] = useState('home');
  const visibleLeads = useMemo(() => LEADS.filter(lead => `${lead.name} ${lead.owner} ${lead.person}`.toLowerCase().includes(query.toLowerCase())), [query]);

  if (activeScreen === 'leads') {
    return <LeadsScreen onHome={() => setActiveScreen('home')} />;
  }

  if (activeScreen === 'add-lead') {
    return <AddLeadScreen onBack={() => setActiveScreen('home')} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#07113D" />
      <View style={styles.header}>
        <View style={styles.brandRow}><Text style={styles.brand}>Snipsor <Text style={styles.brandAccent}>Field</Text></Text></View>
        <Text style={styles.greeting}>Good morning, Priya 👋</Text>
        <Text style={styles.subtitle}>Let's close more salons today</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.overviewBackdrop}>
          <View style={styles.overviewCornerBackdrop} />
          <View style={styles.overview}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Acquisition Overview</Text><Text style={styles.date}>25 Aug 2026</Text></View>
            <View style={styles.statsRow}>
              <StatCard imageSource={teamLeadsIcon} iconColor="#4935F4" iconBackground="#EEECFF" value="124" label="Total Leads" />
              <StatCard imageSource={interestedLeadsIcon} iconColor="#FF5C30" iconBackground="#FFF0E9" value="38" label="Interested" />
              <StatCard imageSource={followUpLeadsIcon} iconColor="#0878F9" iconBackground="#E8F3FF" value="12" label="Follow-ups" />
            </View>
          </View>
        </View>

        <Pressable onPress={() => setActiveScreen('add-lead')} style={({pressed}) => [styles.addButton, pressed && {opacity: 0.9}]}><Text style={styles.addPlus}>＋</Text><Text style={styles.addText}>Add Lead</Text></Pressable>

        <View style={styles.myLeadsHeading}><Text style={styles.myLeads}>My Leads</Text><Text style={styles.viewAll}>View all</Text></View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search leads..." placeholderTextColor="#777D9B" style={styles.searchInput} /></View>
          <Pressable accessibilityLabel="Filter leads" style={styles.filterButton}><Image source={filterIcon} resizeMode="contain" style={styles.filterImage} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter, index) => <Pressable key={filter} onPress={() => setActiveFilter(index)} style={[styles.filterPill, index === activeFilter && styles.filterPillActive, index === 3 && styles.followupFilter]}><Text style={[styles.filterText, index === activeFilter && styles.filterTextActive, index === 3 && {color: '#FF5B3E'}]}>{filter}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.leadsList}>{visibleLeads.map((lead, index) => <LeadCard lead={lead} index={index} key={lead.phone} />)}</View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.navItem}><LineIcon type="home" color="#4E2CF4" /><Text style={[styles.navLabel, styles.navActive]}>Home</Text></Pressable>
        <Pressable onPress={() => setActiveScreen('leads')} style={styles.navItem}><LineIcon type="person" color="#707797" /><Text style={styles.navLabel}>Leads</Text></Pressable>
        <Pressable onPress={() => setActiveScreen('add-lead')} style={styles.fab}><Text style={styles.fabText}>＋</Text></Pressable>
        <Pressable style={styles.navItem}><View style={styles.activityIcon}><View style={styles.activityBar} /><View style={styles.activityBar} /><View style={styles.activityBar} /></View><Text style={styles.navLabel}>Activity</Text></Pressable>
        <Pressable style={styles.navItem}><LineIcon type="person" color="#707797" /><Text style={styles.navLabel}>Profile</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F7F8FC'},
  header: {height: 105, backgroundColor: '#07113D', paddingHorizontal: 12, paddingTop: 8},
  brandRow: {flexDirection: 'row', alignItems: 'center', paddingLeft: 37},
  brand: {color: '#FFFFFF', fontSize: 17, fontWeight: '400', letterSpacing: -0.4}, brandAccent: {color: '#654CFF'},
  greeting: {color: '#FFFFFF', fontSize: 14, fontWeight: '400', lineHeight: 19, marginTop: 20}, subtitle: {color: '#D4D8E8', fontSize: 9, lineHeight: 14, marginTop: 2},
  scrollContent: {paddingHorizontal: 5, paddingBottom: 70},
  overviewBackdrop: {marginHorizontal: -5, marginTop: -4, paddingHorizontal: 8, paddingTop: 20, position: 'relative'},
  overviewCornerBackdrop: {position: 'absolute', top: 0, left: 0, right: 0, height: 88, backgroundColor: '#07113D', borderBottomLeftRadius: 7, borderBottomRightRadius: 7},
  overview: {backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 9, paddingTop: 11, paddingBottom: 8, overflow: 'hidden', shadowColor: '#12204F', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3},
  sectionHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1}, sectionTitle: {color: '#11183C', fontSize: 11, fontWeight: '400'}, date: {color: '#5C6380', fontSize: 8.5, fontWeight: '400'},
  statsRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 7}, statCard: {width: '29%', height: 124, borderWidth: 1, borderColor: '#E6E8F0', borderRadius: 9, paddingHorizontal: 8, paddingTop: 7, paddingBottom: 7, backgroundColor: '#FFFFFF', shadowColor: '#16214C', shadowOpacity: 0.035, shadowRadius: 3, elevation: 1},
  statIcon: {width: 27, height: 27, borderRadius: 7, alignItems: 'center', justifyContent: 'center'}, statValue: {fontSize: 20, color: '#0B1235', fontWeight: '400', marginTop: 14, lineHeight: 23}, statLabel: {fontSize: 9, color: '#3E4562', fontWeight: '400', marginTop: 0},
  statImage: {width: 22, height: 22},
  peopleIcon: {width: 21, height: 21, alignItems: 'center'},
  mainHead: {width: 7, height: 7, borderRadius: 4, borderWidth: 1.8, backgroundColor: 'transparent'},
  mainBody: {width: 13, height: 8, borderWidth: 1.8, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginTop: 2},
  sideHead: {position: 'absolute', top: 3, width: 5, height: 5, borderRadius: 3, borderWidth: 1.4},
  sideHeadLeft: {left: 0}, sideHeadRight: {right: 0},
  groupBase: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, borderWidth: 1.4, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5},
  addButton: {height: 42, backgroundColor: '#07113D', borderRadius: 8, marginHorizontal: 15, marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#07113D', shadowOpacity: 0.16, shadowRadius: 5, elevation: 3}, addPlus: {color: '#FFFFFF', fontSize: 20, marginRight: 7}, addText: {color: '#FFFFFF', fontSize: 15, fontWeight: '400'},
  myLeadsHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 15, marginTop: 19, marginBottom: 11}, myLeads: {color: '#0D1438', fontSize: 15, fontWeight: '400'}, viewAll: {color: '#4D32F4', fontSize: 12, fontWeight: '400'},
  searchRow: {flexDirection: 'row', gap: 9, marginHorizontal: 15}, searchBox: {flex: 1, height: 41, borderWidth: 1.3, borderColor: '#5E67FF', borderRadius: 8, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center'}, searchIcon: {fontSize: 21, color: '#334078', marginLeft: 10, transform: [{rotate: '-20deg'}]}, searchInput: {flex: 1, color: '#10183D', fontSize: 13, paddingHorizontal: 9, paddingVertical: 0},
  filterButton: {width: 43, height: 41, borderWidth: 1, borderColor: '#D9DCE8', borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'}, filterImage: {width: 32, height: 32},
  filters: {gap: 5, paddingHorizontal: 3, paddingVertical: 7}, filterPill: {height: 20, borderRadius: 10, backgroundColor: '#F0F2F7', justifyContent: 'center', paddingHorizontal: 8}, filterPillActive: {backgroundColor: '#10194C'}, followupFilter: {backgroundColor: '#FFF0EC'}, filterText: {color: '#333B60', fontSize: 8, fontWeight: '400'}, filterTextActive: {color: '#FFFFFF'},
  leadsList: {gap: 10, marginHorizontal: 2, paddingVertical: 2}, leadCard: {minHeight: 125, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E6F0', flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, shadowColor: '#29345C', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.1, shadowRadius: 7, elevation: 4},
  shopIcon: {width: 38, height: 38, borderRadius: 9, alignItems: 'center', paddingTop: 8}, awning: {width: 22, height: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3}, shopBody: {width: 20, height: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'flex-end'}, shopDoor: {width: 5, height: 9},
  leadDetails: {flex: 1, marginLeft: 10}, leadName: {color: '#11183A', fontSize: 14.5, fontWeight: '400'}, leadLocation: {color: '#626986', fontSize: 11, marginTop: 3}, contactRow: {flexDirection: 'row', alignItems: 'center', marginTop: 6}, contactName: {color: '#454D6C', fontSize: 11, fontWeight: '400'}, dot: {color: '#9AA0B5', fontSize: 10, marginHorizontal: 4}, contactPhone: {color: '#1D285C', fontSize: 11, fontWeight: '400'}, nextFollowup: {flexDirection: 'row', alignItems: 'center', marginTop: 7}, calendar: {color: '#5C43F3', fontSize: 11, marginRight: 5}, followupText: {color: '#616986', fontSize: 11}, followupDue: {color: '#FF4D34'},
  leadRight: {alignItems: 'flex-end', justifyContent: 'space-between'}, statusPill: {height: 21, borderRadius: 5, paddingHorizontal: 8, justifyContent: 'center'}, statusText: {fontSize: 10.5, fontWeight: '400'}, chevron: {color: '#18245C', fontSize: 23, lineHeight: 23},
  bottomBar: {height: 57, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E8EAF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4}, navItem: {width: 50, alignItems: 'center', justifyContent: 'center'}, navLabel: {color: '#707797', fontSize: 8.5, marginTop: 2, fontWeight: '400'}, navActive: {color: '#4935F4'},
  homeIcon: {position: 'relative', alignItems: 'center', justifyContent: 'flex-end'}, homeRoof: {position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 2, transform: [{rotate: '45deg'}]}, homeBody: {width: 18, height: 14, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, alignItems: 'center', justifyContent: 'flex-end'}, homeDoor: {width: 5, height: 8, backgroundColor: '#FFFFFF', borderTopLeftRadius: 1, borderTopRightRadius: 1}, personHead: {width: 9, height: 9, borderRadius: 5}, personBody: {width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginTop: 2},
  fab: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#4E32F4', marginTop: -20, alignItems: 'center', justifyContent: 'center', shadowColor: '#4E32F4', shadowOpacity: 0.35, shadowRadius: 5, elevation: 6}, fabText: {color: '#FFFFFF', fontSize: 25, fontWeight: '400', marginTop: -2}, activityIcon: {height: 20, flexDirection: 'row', alignItems: 'center', gap: 2}, activityBar: {width: 5, height: 18, borderRadius: 2, backgroundColor: '#41516C'},
});

export default HomeScreen;
