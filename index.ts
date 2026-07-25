import { Platform, UIManager } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

// Enable LayoutAnimation on Android — required for production APK builds.
// In Expo Go this is pre-configured, but native builds need it explicitly.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
