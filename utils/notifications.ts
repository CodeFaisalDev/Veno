import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Requests push notifications permissions, configures the channel (on Android),
 * and returns the Expo push token string if successful.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  // Configure Android notifications channel
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E63946',
      });
    } catch (err) {
      console.warn('Error setting Android notification channel:', err);
    }
  }

  let token = null;

  if (Device.isDevice) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions denied by user.');
        return null;
      }

      // Retrieve project ID from expo config (or EAS)
      const projectId = 
        Constants.expoConfig?.extra?.eas?.projectId || 
        Constants.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      });
      token = tokenData.data;
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('Firebase') || msg.includes('googleServices') || msg.includes('credentials')) {
        console.warn('Push Notifications: Firebase credentials are not configured in your local environment.');
      } else {
        console.warn('Error fetching Expo push token:', msg || error);
      }
    }
  } else {
    console.log('Skipping push token request on simulator/emulator environment.');
  }

  return token;
}
