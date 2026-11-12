import React from 'react';
import { ActivityIndicator, View } from 'react-native';
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
import { DocScreen, MoreScreen, SourcesScreen } from './src/screens/InfoScreens.js';

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
        <Stack.Screen name="Doc" component={DocScreen} options={{ title: '' }} />
        <Stack.Screen name="Sources" component={SourcesScreen} options={{ title: '' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
