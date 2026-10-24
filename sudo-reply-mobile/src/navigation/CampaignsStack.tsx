import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CampaignsPlaceholder } from '../screens/campaigns/CampaignsPlaceholder';

export type CampaignsStackParamList = {
  CampaignsList: undefined;
  // Phase 3: CampaignDetail, CampaignCreate, etc.
};

const Stack = createNativeStackNavigator<CampaignsStackParamList>();

export const CampaignsStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CampaignsList" component={CampaignsPlaceholder} />
  </Stack.Navigator>
);