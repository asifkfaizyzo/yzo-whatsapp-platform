import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CampaignsListScreen } from '../screens/campaigns/CampaignsListScreen';

const Stack = createNativeStackNavigator();

export const CampaignsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CampaignsList" component={CampaignsListScreen} />
  </Stack.Navigator>
);