const fs = require("fs");
const path = require("path");

// 1. Add Camera, Microphone & Audio permissions to AndroidManifest.xml
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = fs.readFileSync(manifestPath, "utf8");
const perms = [
  '    <uses-permission android:name="android.permission.CAMERA" />',
  '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
  '    <uses-feature android:name="android.hardware.microphone" android:required="false" />',
].join("\n");

if (!manifest.includes("android.permission.CAMERA")) {
  manifest = manifest.replace("</manifest>", perms + "\n</manifest>");
  fs.writeFileSync(manifestPath, manifest, "utf8");
}

// 2. Increment versionCode in android/app/build.gradle so updates install cleanly over existing APKs
const gradlePath = "android/app/build.gradle";
let gradle = fs.readFileSync(gradlePath, "utf8");
const runNum = parseInt(process.env.BUILD_NUMBER || "100", 10) + 100;
gradle = gradle.replace(/versionCode\s+\d+/, "versionCode " + runNum);
fs.writeFileSync(gradlePath, gradle, "utf8");

// 3. Patch MainActivity.java to request runtime Camera/Mic permissions & enable autoplay for WebRTC audio/video
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
    "import android.content.pm.PackageManager;",
    "import android.os.Bundle;",
    "import android.webkit.PermissionRequest;",
    "import android.webkit.WebChromeClient;",
    "import androidx.core.app.ActivityCompat;",
    "import androidx.core.content.ContextCompat;",
    "import com.getcapacitor.BridgeActivity;",
    "import java.util.ArrayList;",
    "import java.util.List;",
    "",
    "public class MainActivity extends BridgeActivity {",
    "    @Override",
    "    public void onCreate(Bundle savedInstanceState) {",
    "        super.onCreate(savedInstanceState);",
    "        requestMediaPermissionsIfNeeded();",
    "    }",
    "",
    "    @Override",
    "    public void onStart() {",
    "        super.onStart();",
    "        if (this.bridge != null && this.bridge.getWebView() != null) {",
    "            this.bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);",
    "            this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {",
    "                @Override",
    "                public void onPermissionRequest(final PermissionRequest request) {",
    "                    request.grant(request.getResources());",
    "                }",
    "            });",
    "        }",
    "    }",
    "",
    "    private void requestMediaPermissionsIfNeeded() {",
    "        String[] perms = new String[]{",
    "            Manifest.permission.CAMERA,",
    "            Manifest.permission.RECORD_AUDIO,",
    "            Manifest.permission.MODIFY_AUDIO_SETTINGS",
    "        };",
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
console.log("Android permissions, versionCode, and MainActivity WebRTC permissions patched cleanly.");
