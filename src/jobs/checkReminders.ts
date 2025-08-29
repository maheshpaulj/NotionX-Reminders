// src/jobs/checkReminders.ts
import { Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { adminDb } from '../services/firebase';

// VAPID configuration should be done once when the service starts.
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function checkAndSendReminders() {
  console.log('Starting reminder check job...');
  const now = Timestamp.now();
  const remindersQuery = adminDb
    .collectionGroup('reminders')
    .where('reminderTime', '<=', now)
    .where('isSent', '==', false);

  const dueRemindersSnapshot = await remindersQuery.get();

  if (dueRemindersSnapshot.empty) {
    console.log('No due reminders found.');
    return { success: true, message: 'No reminders to send.' };
  }
  
  console.log(`Found ${dueRemindersSnapshot.size} due reminders.`);

  const notificationsToSend: Promise<any>[] = [];
  const remindersToUpdate: FirebaseFirestore.DocumentReference[] = [];

  for (const reminderDoc of dueRemindersSnapshot.docs) {
    const reminder = reminderDoc.data();
    const userId = reminder.userId;

    // Use a try-catch block for each reminder to prevent one failure from stopping the whole job
    try {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.warn(`User document not found for userId: ${userId}. Skipping reminder.`);
        // Mark as sent to prevent re-processing a reminder for a deleted user
        remindersToUpdate.push(reminderDoc.ref);
        continue;
      }

      const userData = userDoc.data();
      const subscriptions = userData?.pushSubscriptions;
      
      if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
        console.warn(`No push subscriptions found for userId: ${userId}. Skipping.`);
        continue;
      }

      const notificationPayload = JSON.stringify({
        title: reminder.noteTitle ? `Reminder: ${reminder.noteTitle}` : 'You have a reminder!',
        body: reminder.message,
        url: reminder.noteId 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/notes/${reminder.noteId}`
          : `${process.env.NEXT_PUBLIC_APP_URL}/reminders`,
      });

      subscriptions.forEach(sub => {
        notificationsToSend.push(webpush.sendNotification(sub, notificationPayload));
      });

      remindersToUpdate.push(reminderDoc.ref);
    } catch (err) {
      console.error(`Failed to process reminder ${reminderDoc.id} for user ${userId}:`, err);
    }
  }
  
  const results = await Promise.allSettled(notificationsToSend);
  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('Failed to send a notification:', result.reason);
    }
  });
  
  if (remindersToUpdate.length > 0) {
    const batch = adminDb.batch();
    remindersToUpdate.forEach(ref => {
      batch.update(ref, { isSent: true });
    });
    await batch.commit();
    console.log(`Successfully marked ${remindersToUpdate.length} reminders as sent.`);
  }

  return { success: true, message: `Processed ${remindersToUpdate.length} reminders.` };
}