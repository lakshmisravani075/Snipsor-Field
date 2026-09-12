import React from 'react';
import {ImageBackground, StatusBar, StyleSheet, View} from 'react-native';

const splashArtwork = require('../../assets/images/relative/splash-screen.png');

function SplashScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <ImageBackground source={splashArtwork} resizeMode="cover" style={styles.artwork} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#02062F'},
  artwork: {flex: 1, width: '100%', height: '100%'},
});

export default SplashScreen;
