package com.blixtwallet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.widget.Toast;
import java.util.Stack;

import androidx.core.app.NotificationManagerCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.torproject.jni.TorService;

public class BlixtTor extends ReactContextBaseJavaModule {
  static private final String TAG = "BlixtTor";
  static TorService torService;
  static String currentTorStatus = TorService.STATUS_OFF;
  static Stack<Promise> calleeResolvers = new Stack<>();

  static private final ServiceConnection torServiceConnection = new ServiceConnection() {
    @Override
    public void onServiceConnected(ComponentName className, IBinder service) {
      // We've bound to LocalService, cast the IBinder and get LocalService instance
      TorService.LocalBinder binder = (TorService.LocalBinder) service;
      torService = binder.getService();
      Log.i(TAG, "torService.getService()");
      torService.startForeground(0xc0feefee, getNotification(torService));
      Log.i(TAG, "onServiceConnected");
    }

    @Override
    public void onServiceDisconnected(ComponentName arg0) {
      Log.i(TAG, "onServiceDisconnected");
    }

    public Notification getNotification(Context context) {
      Intent notificationIntent = new Intent (context, MainActivity.class);
      PendingIntent pendingIntent =
        PendingIntent.getActivity(context, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        NotificationChannel channel = new NotificationChannel("com.blixtwallet", "blixt", NotificationManager.IMPORTANCE_NONE);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        notificationManager.createNotificationChannel(channel);
        notificationManager.createNotificationChannel(channel);
      }
      return new Notification.Builder(context, "com.blixtwallet")
        .setContentTitle("Blixt Tor")
        .setContentText("Blixt Tor is running in the background")
        .setSmallIcon(R.drawable.ic_stat_ic_notification)
        .setContentIntent(pendingIntent)
        .setTicker("Blixt Wallet")
        .setOngoing(true)
        .build();
    }
  };

  private final BroadcastReceiver torBroadcastReceiver = new BroadcastReceiver() {
    @Override
    public void onReceive(Context context, Intent intent) {
//          Toast.makeText(context, intent.getStringExtra(TorService.EXTRA_STATUS), Toast.LENGTH_SHORT).show();
      String status = intent.getStringExtra(TorService.EXTRA_STATUS);
      currentTorStatus = status;
      Log.i(TAG, "onReceive " + status);
      if (status.equals(TorService.STATUS_ON)) {
        while (calleeResolvers.size() > 0) {
          calleeResolvers.pop().resolve(TorService.socksPort);
        }
      } else if (status.equals(TorService.STATUS_OFF)) {
        getReactApplicationContext().unregisterReceiver(torBroadcastReceiver);
      }
    }
  };

  public BlixtTor(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  public String getName() {
    return "BlixtTor";
  }

  @ReactMethod
  public void startTor(Promise promise) {
    Log.i(TAG, "KOMMER HIT");
//    if (calleeResolver != null) {
//      Log.i(TAG, "calleeResolver != null");
//      promise.reject(TAG, "Tor already in progress starting");
//      return;
//    }
    if (currentTorStatus.equals(TorService.STATUS_ON)) {
      Log.i(TAG, "currentTorStatus.equals(TorService.STATUS_ON) " + currentTorStatus.equals(TorService.STATUS_ON));
      promise.resolve(TorService.socksPort);
      return;
    }
    Log.i(TAG, "KOMMER HIT wat " + currentTorStatus);
    calleeResolvers.add(promise);
    
    getReactApplicationContext().registerReceiver(torBroadcastReceiver, new IntentFilter(TorService.ACTION_STATUS));
    Intent intent = new Intent(getReactApplicationContext(), TorService.class);
    intent.setAction(TorService.ACTION_START);
    getReactApplicationContext().startForegroundService(intent);
    getReactApplicationContext().bindService(intent, torServiceConnection, Context.BIND_AUTO_CREATE);
  }

  @ReactMethod
  public void stopTor(Promise promise) {
    Log.i(TAG,"Unbinding TorService");
    getReactApplicationContext().unbindService(torServiceConnection);
    promise.resolve(true);
  };
}
