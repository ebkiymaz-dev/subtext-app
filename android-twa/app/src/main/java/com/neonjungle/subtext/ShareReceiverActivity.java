package com.neonjungle.subtext;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Receives text from Android's share sheet and opens it in Subtext's paste box. */
public class ShareReceiverActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent incoming = getIntent();
        String text = incoming == null ? null : incoming.getStringExtra(Intent.EXTRA_TEXT);
        String subject = incoming == null ? null : incoming.getStringExtra(Intent.EXTRA_SUBJECT);

        Uri.Builder url = new Uri.Builder()
                .scheme("https")
                .authority("neonjungletools.com")
                .path("subtext/");
        if (subject != null && !subject.trim().isEmpty()) url.appendQueryParameter("title", subject);
        if (text != null && !text.trim().isEmpty()) url.appendQueryParameter("text", text);

        Intent open = new Intent(Intent.ACTION_VIEW, url.build());
        open.setPackage(getPackageName());
        startActivity(open);
        finish();
    }
}
