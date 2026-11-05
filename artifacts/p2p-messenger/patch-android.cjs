const fs = require("fs");
const path = require("path");

// 1. Add Camera, Microphone, Notifications, ForegroundService & WakeLock permissions to AndroidManifest.xml
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = fs.readFileSync(manifestPath, "utf8");
const perms = [
  '    <uses-permission android:name="android.permission.CAMERA" />',
  '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '    <uses-permission android:name="android.permission.WAKE_LOCK" />',
  '    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />',
  '    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />',
  '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
  '    <uses-feature android:name="android.hardware.microphone" android:required="false" />',
].join("\n");

if (!manifest.includes("android.permission.POST_NOTIFICATIONS")) {
  manifest = manifest.replace("</manifest>", perms + "\n</manifest>");
}
if (!manifest.includes("P2PKeepAliveService")) {
  manifest = manifest.replace(
    "</application>",
    '        <service android:name=".P2PKeepAliveService" android:enabled="true" android:exported="false" android:foregroundServiceType="dataSync" />\n    </application>'
  );
}
fs.writeFileSync(manifestPath, manifest, "utf8");

// 2. Copy permanent keystore into android/app/ and force Gradle to sign with it + increment versionCode
fs.copyFileSync("p2p-release.keystore", "android/app/p2p-release.keystore");

const gradlePath = "android/app/build.gradle";
let gradle = fs.readFileSync(gradlePath, "utf8");
const runNum = parseInt(process.env.BUILD_NUMBER || "100", 10) + 500;
gradle = gradle.replace(/versionCode\s+\d+/, "versionCode " + runNum);
gradle = gradle.replace(/versionName\s+"[^"]*"/, 'versionName "1.0.' + (process.env.BUILD_NUMBER || "1") + '"');

if (!gradle.includes("p2p-release.keystore")) {
  const signingSetup = [
    "    signingConfigs {",
    "        debug {",
    "            storeFile file('p2p-release.keystore')",
    "            storePassword 'android'",
    "            keyAlias 'androiddebugkey'",
    "            keyPassword 'android'",
    "        }",
    "    }",
    "    defaultConfig {",
  ].join("\n");
  gradle = gradle.replace("    defaultConfig {", signingSetup);
}
fs.writeFileSync(gradlePath, gradle, "utf8");

// 3. Patch MainActivity.java & create P2PKeepAliveService.java
function findMainActivity(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.name === "MainActivity.java") {
      return full;
    }
  }
  return null;
}

const mainActPath = findMainActivity("android/app/src/main/java");
if (mainActPath) {
  const src = fs.readFileSync(mainActPath, "utf8");
  const pkgMatch = src.match(/package\s+([a-zA-Z0-9_.]+);/);
  const pkg = pkgMatch ? pkgMatch[1] : "app.p2p.messenger";
  const pkgDir = path.dirname(mainActPath);

  const serviceCode = [
    `package ${pkg};`,
    "",
    "import android.app.Notification;",
    "import android.app.NotificationChannel;",
    "import android.app.NotificationManager;",
    "import android.app.PendingIntent;",
    "import android.app.Service;",
    "import android.content.Context;",
    "import android.content.Intent;",
    "import android.net.wifi.WifiManager;",
    "import android.os.Build;",
    "import android.os.IBinder;",
    "import android.os.PowerManager;",
    "import androidx.core.app.NotificationCompat;",
    "",
    "public class P2PKeepAliveService extends Service {",
    "    private static final String CHANNEL_ID = \"p2p_node_service\";",
    "    private PowerManager.WakeLock wakeLock;",
    "    private WifiManager.WifiLock wifiLock;",
    "",
    "    @Override",
    "    public void onCreate() {",
    "        super.onCreate();",
    "        createChannel();",
    "        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);",
    "        if (pm != null) {",
    "            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, \"P2PMessenger::NodeWakeLock\");",
    "            wakeLock.acquire();",
    "        }",
    "        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);",
    "        if (wm != null) {",
    "            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, \"P2PMessenger::NodeWifiLock\");",
    "            wifiLock.acquire();",
    "        }",
    "    }",
    "",
    "    @Override",
    "    public int onStartCommand(Intent intent, int flags, int startId) {",
    "        Intent openIntent = new Intent(this, MainActivity.class);",
    "        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);",
    "        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE);",
    "        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)",
    "            .setContentTitle(\"P2P Encrypted Node Active\")",
    "            .setContentText(\"Listening for direct peer messages & calls\")",
    "            .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)",
    "            .setPriority(NotificationCompat.PRIORITY_LOW)",
    "            .setOngoing(true)",
    "            .setContentIntent(pi)",
    "            .build();",
    "        startForeground(9001, notification);",
    "        return START_STICKY;",
    "    }",
    "",
    "    private void createChannel() {",
    "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {",
    "            NotificationChannel chan = new NotificationChannel(",
    "                CHANNEL_ID, \"P2P Background Node\", NotificationManager.IMPORTANCE_LOW",
    "            );",
    "            chan.setShowBadge(false);",
    "            NotificationManager nm = getSystemService(NotificationManager.class);",
    "            if (nm != null) nm.createNotificationChannel(chan);",
    "        }",
    "    }",
    "",
    "    @Override",
    "    public void onDestroy() {",
    "        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();",
    "        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();",
    "        super.onDestroy();",
    "    }",
    "",
    "    @Override",
    "    public IBinder onBind(Intent intent) {",
    "        return null;",
    "    }",
    "}",
  ].join("\n");
  fs.writeFileSync(path.join(pkgDir, "P2PKeepAliveService.java"), serviceCode, "utf8");

  const patchedMain = [
    `package ${pkg};`,
    "",
    "import android.Manifest;",
    "import android.app.Activity;",
    "import android.app.NotificationChannel;",
    "import android.app.NotificationManager;",
    "import android.app.PendingIntent;",
    "import android.content.Intent;",
    "import android.content.pm.PackageManager;",
    "import android.net.Uri;",
    "import android.os.Build;",
    "import android.os.Bundle;",
    "import android.webkit.JavascriptInterface;",
    "import android.webkit.PermissionRequest;",
    "import android.webkit.ValueCallback;",
    "import android.webkit.WebChromeClient;",
    "import android.webkit.WebView;",
    "import androidx.activity.OnBackPressedCallback;",
    "import androidx.activity.result.ActivityResultLauncher;",
    "import androidx.activity.result.contract.ActivityResultContracts;",
    "import androidx.core.app.ActivityCompat;",
    "import androidx.core.app.NotificationCompat;",
    "import androidx.core.content.ContextCompat;",
    "import com.getcapacitor.BridgeActivity;",
    "import java.util.ArrayList;",
    "import java.util.List;",
    "",
    "public class MainActivity extends BridgeActivity {",
    "    private static final String MSG_CHANNEL_ID = \"p2p_messages_high\";",
    "    private ValueCallback<Uri[]> filePathCallback;",
    "    private ActivityResultLauncher<Intent> fileChooserLauncher;",
    "    private boolean bridgeConfigured = false;",
    "",
    "    public class AndroidJSBridge {",
    "        @JavascriptInterface",
    "        public void showNotification(String title, String body, String tag) {",
    "            runOnUiThread(() -> triggerNativeNotification(title, body, tag));",
    "        }",
    "    }",
    "",
    "    @Override",
    "    public void onCreate(Bundle savedInstanceState) {",
    "        super.onCreate(savedInstanceState);",
    "        createMessageNotificationChannel();",
    "        requestMediaPermissionsIfNeeded();",
    "        startKeepAliveService();",
    "",
    "        fileChooserLauncher = registerForActivityResult(",
    "            new ActivityResultContracts.StartActivityForResult(),",
    "            result -> {",
    "                if (filePathCallback == null) return;",
    "                Uri[] results = null;",
    "                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {",
    "                    Intent data = result.getData();",
    "                    if (data.getClipData() != null) {",
    "                        int count = data.getClipData().getItemCount();",
    "                        results = new Uri[count];",
    "                        for (int i = 0; i < count; i++) {",
    "                            results[i] = data.getClipData().getItemAt(i).getUri();",
    "                        }",
    "                    } else if (data.getData() != null) {",
    "                        results = new Uri[]{ data.getData() };",
    "                    }",
    "                }",
    "                filePathCallback.onReceiveValue(results);",
    "                filePathCallback = null;",
    "            }",
    "        );",
    "",
    "        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {",
    "            @Override",
    "            public void handleOnBackPressed() {",
    "                if (bridge != null && bridge.getWebView() != null) {",
    "                    WebView wv = bridge.getWebView();",
    "                    wv.evaluateJavascript(",
    "                        \"(function(){ if (window.location.pathname !== '/' && window.location.pathname !== '') { window.history.back(); return 'navigated'; } return 'root'; })()\",",
    "                        val -> {",
    "                            if (val != null && val.contains(\"root\")) {",
    "                                moveTaskToBack(true);",
    "                            }",
    "                        }",
    "                    );",
    "                } else {",
    "                    moveTaskToBack(true);",
    "                }",
    "            }",
    "        });",
    "    }",
    "",
    "    @Override",
    "    public void onStart() {",
    "        super.onStart();",
    "        if (!bridgeConfigured && this.bridge != null && this.bridge.getWebView() != null) {",
    "            bridgeConfigured = true;",
    "            WebView wv = this.bridge.getWebView();",
    "            wv.getSettings().setMediaPlaybackRequiresUserGesture(false);",
    "            wv.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);",
    "            wv.getSettings().setAllowFileAccess(true);",
    "            wv.getSettings().setAllowContentAccess(true);",
    "            wv.addJavascriptInterface(new AndroidJSBridge(), \"AndroidNative\");",
    "            wv.setWebChromeClient(new WebChromeClient() {",
    "                @Override",
    "                public void onPermissionRequest(final PermissionRequest request) {",
    "                    request.grant(request.getResources());",
    "                }",
    "",
    "                @Override",
    "                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {",
    "                    if (filePathCallback != null) {",
    "                        filePathCallback.onReceiveValue(null);",
    "                    }",
    "                    filePathCallback = callback;",
    "                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);",
    "                    intent.addCategory(Intent.CATEGORY_OPENABLE);",
    "                    intent.setType(\"*/*\");",
    "                    try {",
    "                        fileChooserLauncher.launch(Intent.createChooser(intent, \"Select Photo, Video, or File\"));",
    "                        return true;",
    "                    } catch (Exception e) {",
    "                        filePathCallback = null;",
    "                        return false;",
    "                    }",
    "                }",
    "            });",
    "        }",
    "    }",
    "",
    "    @Override",
    "    public void onPause() {",
    "        super.onPause();",
    "        if (this.bridge != null && this.bridge.getWebView() != null) {",
    "            this.bridge.getWebView().onResume();",
    "            this.bridge.getWebView().resumeTimers();",
    "        }",
    "    }",
    "",
    "    private void startKeepAliveService() {",
    "        try {",
    "            Intent s = new Intent(this, P2PKeepAliveService.class);",
    "            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {",
    "                startForegroundService(s);",
    "            } else {",
    "                startService(s);",
    "            }",
    "        } catch (Exception ignored) {}",
    "    }",
    "",
    "    private void createMessageNotificationChannel() {",
    "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {",
    "            NotificationChannel chan = new NotificationChannel(",
    "                MSG_CHANNEL_ID, \"Encrypted Messages & Calls\", NotificationManager.IMPORTANCE_HIGH",
    "            );",
    "            chan.enableVibration(true);",
    "            NotificationManager nm = getSystemService(NotificationManager.class);",
    "            if (nm != null) nm.createNotificationChannel(chan);",
    "        }",
    "    }",
    "",
    "    private void triggerNativeNotification(String title, String body, String tag) {",
    "        try {",
    "            Intent openIntent = new Intent(this, MainActivity.class);",
    "            openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);",
    "            PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE);",
    "            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, MSG_CHANNEL_ID)",
    "                .setSmallIcon(android.R.drawable.stat_notify_chat)",
    "                .setContentTitle(title != null ? title : \"New Encrypted Message\")",
    "                .setContentText(body != null ? body : \"Open app to view\")",
    "                .setPriority(NotificationCompat.PRIORITY_HIGH)",
    "                .setDefaults(NotificationCompat.DEFAULT_ALL)",
    "                .setAutoCancel(true)",
    "                .setContentIntent(pi);",
    "            NotificationManager nm = getSystemService(NotificationManager.class);",
    "            if (nm != null) {",
    "                int id = (tag != null ? tag.hashCode() : (int) System.currentTimeMillis());",
    "                nm.notify(id, builder.build());",
    "            }",
    "        } catch (Exception ignored) {}",
    "    }",
    "",
    "    private void requestMediaPermissionsIfNeeded() {",
    "        List<String> perms = new ArrayList<>();",
    "        perms.add(Manifest.permission.CAMERA);",
    "        perms.add(Manifest.permission.RECORD_AUDIO);",
    "        perms.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);",
    "        if (Build.VERSION.SDK_INT >= 33) {",
    "            perms.add(\"android.permission.POST_NOTIFICATIONS\");",
    "        }",
    "        List<String> needed = new ArrayList<>();",
    "        for (String p : perms) {",
    "            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {",
    "                needed.add(p);",
    "            }",
    "        }",
    "        if (!needed.isEmpty()) {",
    "            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 1001);",
    "        }",
    "    }",
    "}",
  ].join("\n");
  fs.writeFileSync(mainActPath, patchedMain, "utf8");
}
console.log("Patched Android native file chooser, back handler, foreground service, and notifications.");


// 4. Generate Light & Dark Android Launcher Icons across all mipmap densities
try {
  const { execSync } = require("child_process");
  const resDir = "android/app/src/main/res";
  const densities = [
    { name: "mdpi", size: 48, fg: 108 },
    { name: "hdpi", size: 72, fg: 162 },
    { name: "xhdpi", size: 96, fg: 216 },
    { name: "xxhdpi", size: 144, fg: 324 },
    { name: "xxxhdpi", size: 192, fg: 432 },
  ];

  const darkPng = "assets/images/icon-dark.png";
  const lightPng = "assets/images/icon-light.png";

  if (fs.existsSync(darkPng) && fs.existsSync(lightPng)) {
    fs.mkdirSync(resDir + "/drawable", { recursive: true });
    fs.mkdirSync(resDir + "/drawable-night-v8", { recursive: true });
    fs.copyFileSync(lightPng, resDir + "/drawable/ic_launcher_theme.png");
    fs.copyFileSync(darkPng, resDir + "/drawable-night-v8/ic_launcher_theme.png");

    for (const d of densities) {
      const mipDir = resDir + "/mipmap-" + d.name;
      const nightMipDir = resDir + "/mipmap-" + d.name + "-night-v8";
      fs.mkdirSync(mipDir, { recursive: true });
      fs.mkdirSync(nightMipDir, { recursive: true });

      for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
        fs.copyFileSync(lightPng, mipDir + "/" + name);
        fs.copyFileSync(darkPng, nightMipDir + "/" + name);
      }
    }

    const adaptiveXml = [
      "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
      "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">",
      "    <background android:drawable=\"@drawable/ic_launcher_theme\"/>",
      "    <foreground android:drawable=\"@drawable/ic_launcher_theme\"/>",
      "</adaptive-icon>",
    ].join("\n");

    const anyDpiDir = resDir + "/mipmap-anydpi-v26";
    fs.mkdirSync(anyDpiDir, { recursive: true });
    fs.writeFileSync(anyDpiDir + "/ic_launcher.xml", adaptiveXml, "utf8");
    fs.writeFileSync(anyDpiDir + "/ic_launcher_round.xml", adaptiveXml, "utf8");
    console.log("Installed Light & Dark adaptive Android launcher icons.");
  }
} catch (err) {
  console.warn("Icon patch warning:", err.message);
}
