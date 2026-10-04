package de.lauri.bfwenglisch;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void syncTopics(String json) {
                    Context ctx = getApplicationContext();
                    ctx.getSharedPreferences(VocabContentProvider.PREF_NAME, Context.MODE_PRIVATE)
                            .edit()
                            .putString(VocabContentProvider.KEY_TOPICS, json)
                            .apply();

                    // Explicit Broadcast to VokabelStar
                    Intent starIntent = new Intent("de.lauri.vokabel.SYNC");
                    starIntent.setPackage("de.lauri.vokabelstar");
                    ctx.sendBroadcast(starIntent);

                    // Explicit Broadcast to VokabelMeister
                    Intent meisterIntent = new Intent("de.lauri.vokabel.SYNC");
                    meisterIntent.setPackage("de.lauri.vokabelmeister");
                    ctx.sendBroadcast(meisterIntent);
                }

                @JavascriptInterface
                public void openApp(String packageName) {
                    Context ctx = getApplicationContext();
                    Intent launchIntent = ctx.getPackageManager().getLaunchIntentForPackage(packageName);
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        ctx.startActivity(launchIntent);
                    }
                }
            }, "AndroidSyncBridge");
        }
    }
}
