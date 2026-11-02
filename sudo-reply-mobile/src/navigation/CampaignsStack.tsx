import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CampaignsListScreen } from '../screens/campaigns/CampaignsListScreen';
import { CampaignWizardStep1 } from '../screens/campaigns/CampaignWizardStep1';
import { CampaignWizardStep2 } from '../screens/campaigns/CampaignWizardStep2';
import { CampaignWizardStep3 } from '../screens/campaigns/CampaignWizardStep3';
import { CampaignWizardStep4 } from '../screens/campaigns/CampaignWizardStep4';

const Stack = createNativeStackNavigator();

export const CampaignsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CampaignsList" component={CampaignsListScreen} />
    <Stack.Screen name="CampaignWizardStep1" component={CampaignWizardStep1} />
    <Stack.Screen name="CampaignWizardStep2" component={CampaignWizardStep2} />
    <Stack.Screen name="CampaignWizardStep3" component={CampaignWizardStep3} />
    <Stack.Screen name="CampaignWizardStep4" component={CampaignWizardStep4} />
  </Stack.Navigator>
);