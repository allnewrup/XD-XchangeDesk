import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, useApp } from './src/state/AppState.js';
import { C } from './src/theme.js';
import CompareScreen from './src/screens/CompareScreen.js';
import MapScreen from './src/screens/MapScreen.js';
import SavedScreen from './src/screens/SavedScreen.js';
import ProviderScreen from './src/screens/ProviderScreen.js';
import StoreScreen from './src/screens/StoreScreen.js';
import { DocScreen, MoreScreen, SourcesScreen } from './src/screens/InfoScreens.js';

/** Shows the error on screen instead of letting the app close with no explanation. */
class CrashGuard extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: C.ink }}>Something went wrong</Text>
        <Text style={{ fontSize: 15, color: C.muted }}>Xchange Desk hit an unexpected error. Please close the app and open it again. If it keeps happening, send the text below to xchangedesk@gmail.com.</Text>
        <Text selectable style={{ fontSize: 12, color: C.bad }}>{String(e?.message ?? e)}{'\n\n'}{String(e?.stack ?? '').slice(0, 1200)}</Text>
      </ScrollView>
    );
  }
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: C.sky, background: C.bg, card: C.card, text: C.ink, border: C.line } };
const ICONS = { Compare: ['swap-horizontal', 'swap-horizontal-outline'], Map: ['map', 'map-outline'], Saved: ['star', 'star-outline'], More: ['ellipsis-horizontal-circle', 'ellipsis-horizontal-circle-outline'] };

function Tabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarActiveTintColor: C.sky, tabBarInactiveTintColor: C.faint,
      tabBarIcon: ({ focused, color, size }) => <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />,
    })}>
      <Tab.Screen name="Compare" component={CompareScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="More" component={MoreScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { ready } = useApp();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.sky} /></View>;
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: C.sky }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Provider" component={ProviderScreen} options={{ title: 'Provider' }} />
        <Stack.Screen name="Store" component={StoreScreen} options={{ title: 'Store' }} />
        <Stack.Screen name="Doc" component={DocScreen} options={{ title: '' }} />
        <Stack.Screen name="Sources" component={SourcesScreen} options={{ title: '' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CrashGuard>
        <AppProvider>
          <StatusBar style="dark" />
          <Root />
        </AppProvider>
      </CrashGuard>
    </SafeAreaProvider>
  );
}
