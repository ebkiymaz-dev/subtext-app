package com.neonjungle.subtext;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;

/** A direct notification activity intent closes the notification shade before capture. */
public final class CaptureActionActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!ConversationAssistantService.isRunning()) {
            startActivity(new Intent(this, MainActivity.class));
        } else {
            final android.content.Context app = getApplicationContext();
            new Handler(getMainLooper()).postDelayed(() -> {
                if (ConversationAssistantService.isRunning()) {
                    app.startService(new Intent(app, ConversationAssistantService.class)
                        .setAction(ConversationAssistantService.ACTION_CAPTURE));
                }
            }, 500);
        }
        finish();
        overridePendingTransition(0, 0);
    }
}
