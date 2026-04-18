import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { NativePlatformProvider } from '@librecord/platform-native';
import {
  nativeHttpClient,
  nativeEventBus,
  nativeStorage,
} from '@librecord/platform-native';
import {
  setApiUrl,
  setHttpClient,
  setEventBus,
  setConnectionEventBus,
} from '@librecord/api-client';
// Subpath import — the `@librecord/app` barrel eagerly loads livekit-client and
// rnnoise-wasm, both browser-only. The /context subpath only pulls the React
// providers, no voice or realtime code.
import { AuthProvider } from '@librecord/app/context';
import { RootNavigator } from '@librecord/ui-native';

// TODO: move to a config surface once we have multiple environments.
const DEFAULT_API_URL = 'https://librecord.gros-sans-dessein.com/api';

// Wire api-client against the native adapters before anything renders.
setApiUrl(nativeStorage.get('lr:api-url') ?? DEFAULT_API_URL);
setHttpClient(nativeHttpClient);
setEventBus(nativeEventBus);
setConnectionEventBus(nativeEventBus);

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <NativePlatformProvider>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </NativePlatformProvider>
  );
}

export default App;
