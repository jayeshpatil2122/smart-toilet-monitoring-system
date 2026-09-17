import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const notificationService = {
  // Initialize Notification Channel & FCM Push Registration
  init: async (onFcmTokenReceived, onTapCallback) => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // 1. Create Android Notification Channel for High Importance task alerts
      await LocalNotifications.createChannel({
        id: 'sanitrax_tasks',
        name: 'Sanitrax Worker Tasks',
        description: 'Notifications for new assigned sanitation complaints',
        importance: 5, // High Importance (Sound + Banner + Vibration)
        visibility: 1, // Public on lockscreen
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#10B981'
      });

      // 2. Request Notification Permission (Android 13+)
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // 3. Register FCM Push Notifications
      try {
        const pushPerm = await PushNotifications.checkPermissions();
        if (pushPerm.receive !== 'granted') {
          await PushNotifications.requestPermissions();
        }
        await PushNotifications.register();

        PushNotifications.addListener('registration', (token) => {
          if (token && token.value) {
            console.log('FCM Registration Token:', token.value);
            if (onFcmTokenReceived) {
              onFcmTokenReceived(token.value);
            }
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.warn('FCM registration notice:', err);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification?.data;
          const complaintId = data?.complaint_id || data?.complaintId;
          if (complaintId && onTapCallback) {
            onTapCallback(complaintId);
          }
        });
      } catch (fcmErr) {
        console.warn('FCM Push Notification setup notice:', fcmErr);
      }
    } catch (err) {
      console.warn('Native local notification initialization warning:', err);
    }
  },

  // Post a real Android System Notification in top status bar
  scheduleTaskNotification: async (complaint) => {
    if (!complaint || !complaint.id) return;

    // Build notification text content
    const title = `🔔 New Complaint Assigned #${complaint.id}`;
    const body = `${complaint.toilet || 'Public Toilet'}\nIssue: ${complaint.title || complaint.category || 'Sanitation Task'} [${complaint.priority || 'MEDIUM'}]`;
    const notificationId = Math.abs(parseInt(String(complaint.id).replace(/\D/g, ''), 10)) || Math.floor(Math.random() * 100000);

    // 1. Post native Android System Notification if on mobile APK
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: title,
              body: body,
              id: notificationId,
              schedule: { at: new Date(Date.now() + 100) }, // Trigger immediately
              sound: 'default',
              attachments: null,
              actionTypeId: '',
              extra: {
                complaintId: String(complaint.id)
              },
              channelId: 'sanitrax_tasks',
              smallIcon: 'ic_launcher'
            }
          ]
        });
      } catch (err) {
        console.warn('Native notification schedule error:', err);
      }
    }
  },

  // Listen for Notification Tap to navigate to assigned complaint
  attachTapListener: (onTapCallback) => {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      const listener = LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const extraData = notificationAction.notification?.extra;
        if (extraData && extraData.complaintId && onTapCallback) {
          onTapCallback(extraData.complaintId);
        }
      });
      return listener;
    } catch (err) {
      console.warn('Tap notification listener error:', err);
      return null;
    }
  }
};
