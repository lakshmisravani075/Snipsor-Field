import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';
import LeadsScreen from '../leads/LeadsScreen.js';
import AddLeadScreen from '../leads/AddLeadScreen.js';
import LogoutScreen from '../profile/LogoutScreen.js';

function AcquisitionBottomBar({activeTab, onLeads, onAddLead, onProfile}) {
  return (
    <View style={styles.bottomBar}>
      <Pressable onPress={onLeads} style={styles.navItem}>
        <Ionicons name="people-outline" size={22} color={activeTab === 'leads' ? '#4D32F4' : '#707797'} />
        <Text style={[styles.navLabel, activeTab === 'leads' && styles.navActive]}>Leads</Text>
      </Pressable>
      <Pressable onPress={onAddLead} style={styles.navItem}>
        <Ionicons name="person-add-outline" size={22} color={activeTab === 'add-lead' ? '#4D32F4' : '#707797'} />
        <Text style={[styles.navLabel, activeTab === 'add-lead' && styles.navActive]}>Add Lead</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onProfile} style={styles.navItem}>
        <Ionicons name="person-outline" size={22} color={activeTab === 'profile' ? '#4D32F4' : '#707797'} />
        <Text style={[styles.navLabel, activeTab === 'profile' && styles.navActive]}>Profile</Text>
      </Pressable>
    </View>
  );
}

function HomeScreen({onLogout}) {
  const [activeScreen, setActiveScreen] = useState('leads');

  if (activeScreen === 'add-lead') {
    return <AddLeadScreen onBack={() => setActiveScreen('leads')} onSessionExpired={onLogout} />;
  }

  if (activeScreen === 'profile') {
    return (
      <LogoutScreen
        onLogout={onLogout}
        onBack={() => setActiveScreen('leads')}
        bottomBar={(
          <AcquisitionBottomBar
            activeTab="profile"
            onLeads={() => setActiveScreen('leads')}
            onAddLead={() => setActiveScreen('add-lead')}
          />
        )}
      />
    );
  }

  return <LeadsScreen onAddLead={() => setActiveScreen('add-lead')} onProfile={() => setActiveScreen('profile')} onSessionExpired={onLogout} />;
}

const styles = StyleSheet.create({
  bottomBar: {height: 61, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E7E9F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 42},
  navItem: {width: 64, alignItems: 'center'},
  navLabel: {color: '#707797', fontSize: 9, marginTop: 3, fontFamily: 'Inter_400Regular'},
  navActive: {color: '#4D32F4'},
});

export default HomeScreen;
