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
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.widget.Toast;

import java.net.InetSocketAddress;
import java.net.Proxy;
import java.util.Stack;

import androidx.core.app.NotificationManagerCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.network.OkHttpClientFactory;
import com.facebook.react.modules.network.ReactCookieJarContainer;
import com.facebook.react.modules.storage.AsyncLocalStorageUtil;
import com.facebook.react.modules.storage.ReactDatabaseSupplier;

import org.torproject.jni.TorService;

import okhttp3.OkHttpClient;

public class BlixtTor extends ReactContextBaseJavaModule {
  static private final String TAG = "BlixtTor";
  static TorService torService;
  static String currentTorStatus = TorService.STATUS_OFF;
  static Stack<Promise> calleeResolvers = new Stack<>();
  static NotificationManagerCompat notificationManager;

  static private boolean getPersistentServicesEnabled(Context context) {
    ReactDatabaseSupplier dbSupplier = ReactDatabaseSupplier.getInstance(context);
    SQLiteDatabase db = dbSupplier.get();
    String persistentServicesEnabled = AsyncLocalStorageUtil.getItemImpl(db, "persistentServicesEnabled");
    if (persistentServicesEnabled != null) {
      return persistentServicesEnabled.equals("true");
    }
    Log.w(TAG, "Could not find persistentServicesEnabled in asyncStorage");
    return false;
  }

  static private final ServiceConnection torServiceConnection = new ServiceConnection() {
    @Override
    public void onServiceConnected(ComponentName className, IBinder service) {
      // We've bound to LocalService, cast the IBinder and get LocalService instance
      TorService.LocalBinder binder = (TorService.LocalBinder) service;
      torService = binder.getService();
      Log.i(TAG, "torService.getService()");
      boolean persistentServicesEnabled = getPersistentServicesEnabled(torService);
      if (persistentServicesEnabled) {
        torService.startForeground(0xc0feefee, getNotification(torService));
      }
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
        notificationManager = NotificationManagerCompat.from(context);
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
      if (intent != null && intent.getAction() != null && intent.getAction().equals("org.torproject.android.intent.action.STOP")) {
        torService.stopSelf();
      }
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
    Log.i(TAG, "startTor()");
//    if (calleeResolver != null) {
//      Log.i(TAG, "calleeResolver != null");
//      promise.reject(TAG, "Tor already in progress starting");
//      return;
//    }
    if (currentTorStatus.equals(TorService.STATUS_ON)) {
      Log.i(TAG, "currentTorStatus.equals(TorService.STATUS_ON)" + currentTorStatus.equals(TorService.STATUS_ON));

      // Make sure OkHttp is proxied via SOCKS Tor.
      // This makes sure that `fetch` is proxied in Javascript-land.
      com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory(new OkHttpClientFactory() {
        @Override
        public OkHttpClient createNewNetworkModuleClient() {
          OkHttpClient.Builder okHttpClientBuilder = new OkHttpClient.Builder();
          okHttpClientBuilder.proxy(new Proxy(Proxy.Type.SOCKS, new InetSocketAddress("127.0.0.1", TorService.socksPort)));
          okHttpClientBuilder.cookieJar(new ReactCookieJarContainer());
          return okHttpClientBuilder.build();
        }
      });
      com.facebook.react.modules.network.OkHttpClientProvider.createClient(getReactApplicationContext());

      promise.resolve(TorService.socksPort);
      return;
    }
    calleeResolvers.add(promise);
    
    boolean persistentServicesEnabled = getPersistentServicesEnabled(getReactApplicationContext());
    getReactApplicationContext().registerReceiver(torBroadcastReceiver, new IntentFilter(TorService.ACTION_STATUS));
    Intent intent = new Intent(getReactApplicationContext(), TorService.class);
    
    if (persistentServicesEnabled) {
      getReactApplicationContext().startForegroundService(intent);
    }
    getReactApplicationContext().bindService(intent, torServiceConnection, Context.BIND_AUTO_CREATE);
  }

  @ReactMethod
  public void stopTor(Promise promise) {
    if (notificationManager != null) {
      notificationManager.cancelAll();
    }
    Log.i(TAG,"Unbinding TorService");
    getReactApplicationContext().unbindService(torServiceConnection);
    promise.resolve(true);
  };
}
