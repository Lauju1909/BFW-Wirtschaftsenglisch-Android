package de.lauri.bfwenglisch;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

public class VocabContentProvider extends ContentProvider {
    public static final String AUTHORITY = "de.lauri.bfwenglisch.vocabprovider";
    public static final String PREF_NAME = "bfw_shared_vocab";
    public static final String KEY_TOPICS = "downloaded_topics_json";
    private static final String TAG = "VocabContentProvider";

    @Override
    public boolean onCreate() {
        Log.d(TAG, "VocabContentProvider created successfully");
        return true;
    }

    @Override
    public Bundle call(String method, String arg, Bundle extras) {
        return handleCall(method, arg, extras);
    }

    @Override
    public Bundle call(String authority, String method, String arg, Bundle extras) {
        return handleCall(method, arg, extras);
    }

    private Bundle handleCall(String method, String arg, Bundle extras) {
        Bundle result = new Bundle();
        Context ctx = getContext();
        if (ctx == null) {
            Log.e(TAG, "Context is null in handleCall");
            return result;
        }

        SharedPreferences prefs = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        if ("getInstalledTopics".equals(method)) {
            String json = prefs.getString(KEY_TOPICS, "[]");
            Log.d(TAG, "getInstalledTopics requested, returning json length: " + (json != null ? json.length() : 0));
            result.putString("topics_json", json);
        } else if ("saveInstalledTopics".equals(method)) {
            if (extras != null && extras.containsKey("topics_json")) {
                String json = extras.getString("topics_json");
                prefs.edit().putString(KEY_TOPICS, json).apply();
                Log.d(TAG, "saveInstalledTopics saved json length: " + (json != null ? json.length() : 0));
            }
        }

        return result;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public String getType(Uri uri) {
        return "application/json";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
