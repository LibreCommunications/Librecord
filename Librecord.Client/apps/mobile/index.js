/**
 * @format
 */

// MUST be first — replaces RN's incomplete URL with a spec-compliant one.
// SignalR's _resolveNegotiateUrl assigns to url.pathname, which RN's default
// URL exposes only as a read-only getter.
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
