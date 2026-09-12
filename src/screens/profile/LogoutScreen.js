import React from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Ionicons} from '@react-native-vector-icons/ionicons/static';

function LogoutScreen({onLogout, onBack, bottomBar}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={onBack}
        style={({pressed}) => [styles.backButton, pressed && styles.pressed]}>
        <Ionicons name="arrow-back" size={27} color="#17203B" />
      </Pressable>
      <View style={styles.content}>
        <Ionicons name="log-out-outline" size={92} color="#3420C6" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Logout"
          onPress={onLogout}
          style={({pressed}) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
      {bottomBar}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  backButton: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 1,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 54,
  },
  logoutButton: {
    width: '100%',
    maxWidth: 300,
    height: 55,
    marginTop: 34,
    borderRadius: 11,
    backgroundColor: '#3420C6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3420C6',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  pressed: {opacity: 0.65},
  logoutButtonPressed: {opacity: 0.86},
  logoutText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },
});

export default LogoutScreen;
