import React from 'react';
import {Image, StatusBar, StyleSheet, View} from 'react-native';

// Keep the versioned filename so Metro and Android do not reuse a stale image cache.
const splashArtwork = require('../../assets/images/relative/splash-screen-v3.png');

function SplashScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor="transparent" hidden translucent />
      <Image
        fadeDuration={0}
        resizeMethod="resize"
        resizeMode="cover"
        source={splashArtwork}
        style={styles.artwork}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#02062F'},
  artwork: {...StyleSheet.absoluteFillObject, width: '100%', height: '100%'},
});

export default SplashScreen;
