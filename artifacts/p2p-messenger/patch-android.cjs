const fs = require("fs");
const path = require("path");

// 1. Add Camera, Microphone, Notifications, WakeLock & File permissions to AndroidManifest.xml
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = fs.readFileSync(manifestPath, "utf8");
const perms = [
  '    <uses-permission android:name="android.permission.CAMERA" />',
  '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '    <uses-permission android:name="android.permission.VIBRATE" />',
  '    <uses-permission android:name="android.permission.WAKE_LOCK" />',
  '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
  '    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
  '    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
  '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
  '    <uses-feature android:name="android.hardware.microphone" android:required="false" />',
].join("\n");

if (!manifest.includes("android.permission.POST_NOTIFICATIONS")) {
  manifest = manifest.replace("</manifest>", perms + "\n</manifest>");
  fs.writeFileSync(manifestPath, manifest, "utf8");
}

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

// 3. Patch MainActivity.java for:
//    - File/Photo/Video/Document Chooser (onShowFileChooser)
//    - Native Push Notifications Bridge (window.AndroidNative.notify)
//    - Background WebView keep-alive + Partial WakeLock so P2P messages arrive when minimized
//    - Hardware Back Button navigation (returns from chat to home tab instead of closing app)
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
  const patchedMain = [
    `package ${pkg};`,
    "",
    "import android.Manifest;",
    "import android.app.Activity;",
    "import android.app.NotificationChannel;",
    "import android.app.NotificationManager;",
    "import android.app.PendingIntent;",
    "import android.content.Context;",
    "import android.content.Intent;",
    "import android.content.pm.PackageManager;",
    "import android.net.Uri;",
    "import android.os.Build;",
    "import android.os.Bundle;",
    "import android.os.PowerManager;",
    "import android.view.View;",
    "import android.webkit.JavascriptInterface;",
    "import android.webkit.PermissionRequest;",
    "import android.webkit.ValueCallback;",
    "import android.webkit.WebChromeClient;",
    "import android.webkit.WebView;",
    "import androidx.activity.OnBackPressedCallback;",
    "import androidx.core.app.ActivityCompat;",
    "import androidx.core.app.NotificationCompat;",
    "import androidx.core.content.ContextCompat;",
    "import com.getcapacitor.BridgeActivity;",
    "import java.util.ArrayList;",
    "import java.util.List;",
    "",
    "public class MainActivity extends BridgeActivity {",
    "    private static final int FILE_CHOOSER_REQUEST_CODE = 2002;",
    "    private static final String CHANNEL_ID = \"p2p_messages_channel\";",
    "    private ValueCallback<Uri[]> filePathCallback;",
    "    private PowerManager.WakeLock wakeLock;",
    "    private boolean jsBridgeAttached = false;",
    "",
    "    public class AndroidNativeBridge {",
    "        @JavascriptInterface",
    "        public void notify(String title, String body, String tag) {",
    "            showNativeNotification(title, body, tag);",
    "        }",
    "    }",
    "",
    "    @Override",
    "    public void onCreate(Bundle savedInstanceState) {",
    "        super.onCreate(savedInstanceState);",
    "        createNotificationChannel();",
    "        requestMediaPermissionsIfNeeded();",
    "        acquirePartialWakeLock();",
    "",
    "        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {",
    "            @Override",
    "            public void handleOnBackPressed() {",
    "                if (bridge != null && bridge.getWebView() != null) {",
    "                    final WebView wv = bridge.getWebView();",
    "                    wv.evaluateJavascript(",
    "                        \"(function(){ var p = window.location.pathname || ''; if (p !== '/' && p !== '/index.html') { if (window.history.length > 1) { window.history.back(); } else { window.location.replace('/'); } return 'HANDLED'; } return 'ROOT'; })()\",",
    "                        new ValueCallback<String>() {",
    "                            @Override",
    "                            public void onReceiveValue(String value) {",
    "                                if (value != null && value.contains(\"HANDLED\")) {",
    "                                    return;",
    "                                }",
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
    "        if (this.bridge != null && this.bridge.getWebView() != null) {",
    "            WebView wv = this.bridge.getWebView();",
    "            wv.getSettings().setMediaPlaybackRequiresUserGesture(false);",
    "            wv.getSettings().setAllowFileAccess(true);",
    "            wv.getSettings().setAllowContentAccess(true);",
    "            if (!jsBridgeAttached) {",
    "                wv.addJavascriptInterface(new AndroidNativeBridge(), \"AndroidNative\");",
    "                jsBridgeAttached = true;",
    "            }",
    "            wv.setWebChromeClient(new WebChromeClient() {",
    "                @Override",
    "                public void onPermissionRequest(final PermissionRequest request) {",
    "                    request.grant(request.getResources());",
    "                }",
    "",
    "                @Override",
    "                public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams fileChooserParams) {",
    "                    if (filePathCallback != null) {",
    "                        filePathCallback.onReceiveValue(null);",
    "                    }",
    "                    filePathCallback = callback;",
    "                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);",
    "                    intent.addCategory(Intent.CATEGORY_OPENABLE);",
    "                    intent.setType(\"*/*\");",
    "                    String[] mimeTypes = new String[]{\"image/*\", \"video/*\", \"audio/*\", \"application/*\", \"text/*\"};",
    "                    intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);",
    "                    try {",
    "                        startActivityForResult(Intent.createChooser(intent, \"Share Photo, Video or File\"), FILE_CHOOSER_REQUEST_CODE);",
    "                    } catch (Exception e) {",
    "                        filePathCallback = null;",
    "                        return false;",
    "                    }",
    "                    return true;",
    "                }",
    "            });",
    "        }",
    "    }",
    "",
    "    @Override",
    "    public void onPause() {",
    "        super.onPause();",
    "        // Keep WebView timers and WebRTC P2P data channels alive in background",
    "        if (this.bridge != null && this.bridge.getWebView() != null) {",
    "            this.bridge.getWebView().onResume();",
    "            this.bridge.getWebView().resumeTimers();",
    "        }",
    "    }",
    "",
    "    @Override",
    "    protected void onActivityResult(int requestCode, int resultCode, Intent data) {",
    "        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {",
    "            if (filePathCallback != null) {",
    "                Uri[] results = null;",
    "                if (resultCode == Activity.RESULT_OK && data != null) {",
    "                    String dataString = data.getDataString();",
    "                    if (dataString != null) {",
    "                        results = new Uri[]{Uri.parse(dataString)};",
    "                    } else if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {",
    "                        results = new Uri[]{data.getClipData().getItemAt(0).getUri()};",
    "                    }",
    "                }",
    "                filePathCallback.onReceiveValue(results);",
    "                filePathCallback = null;",
    "            }",
    "            return;",
    "        }",
    "        super.onActivityResult(requestCode, resultCode, data);",
    "    }",
    "",
    "    private void createNotificationChannel() {",
    "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {",
    "            NotificationChannel channel = new NotificationChannel(",
    "                CHANNEL_ID,",
    "                \"Encrypted P2P Messages & Calls\",",
    "                NotificationManager.IMPORTANCE_HIGH",
    "            );",
    "            channel.setDescription(\"Direct peer-to-peer message and call alerts\");",
    "            channel.enableVibration(true);",
    "            NotificationManager manager = getSystemService(NotificationManager.class);",
    "            if (manager != null) {",
    "                manager.createNotificationChannel(channel);",
    "            }",
    "        }",
    "    }",
    "",
    "    private void showNativeNotification(String title, String body, String tag) {",
    "        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);",
    "        if (manager == null) return;",
    "        Intent intent = new Intent(this, MainActivity.class);",
    "        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);",
    "        int flags = PendingIntent.FLAG_UPDATE_CURRENT;",
    "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {",
    "            flags |= PendingIntent.FLAG_IMMUTABLE;",
    "        }",
    "        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);",
    "        int iconId = getApplicationInfo().icon;",
    "        if (iconId == 0) iconId = android.R.drawable.sym_action_chat;",
    "        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)",
    "            .setSmallIcon(iconId)",
    "            .setContentTitle(title != null ? title : \"New Encrypted Message\")",
    "            .setContentText(body != null ? body : \"You received a new P2P message\")",
    "            .setPriority(NotificationCompat.PRIORITY_HIGH)",
    "            .setCategory(NotificationCompat.CATEGORY_MESSAGE)",
    "            .setAutoCancel(true)",
    "            .setDefaults(NotificationCompat.DEFAULT_ALL)",
    "            .setContentIntent(pendingIntent);",
    "        int notifId = (tag != null ? tag.hashCode() : (int) System.currentTimeMillis());",
    "        manager.notify(notifId, builder.build());",
    "    }",
    "",
    "    private void acquirePartialWakeLock() {",
    "        try {",
    "            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);",
    "            if (pm != null && wakeLock == null) {",
    "                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, \"P2PMessenger::BackgroundNodeLock\");",
    "                wakeLock.acquire();",
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
console.log("Patched Android keystore, file chooser, native notifications, background wake-lock, and back button.");
