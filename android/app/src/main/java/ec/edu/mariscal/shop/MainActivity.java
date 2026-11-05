package ec.edu.mariscal.shop;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Contenedor Android de la tienda web Mariscal Shop.
 * Carga la app publicada en GitHub Pages, así cualquier cambio en la web
 * llega a la app sin tener que reinstalar la APK.
 */
public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int NOTIF_PERMISSION_REQUEST = 1002;
    private static final String CHANNEL_ID = "pedidos";
    private static final String EXTRA_GOTO = "goto";
    private int notificationId = 1;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private final String storeUrl = BuildConfig.STORE_URL;
    private final String storeHost = Uri.parse(BuildConfig.STORE_URL).getHost();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        // La web detecta que corre dentro de la app con esta marca
        s.setUserAgentString(s.getUserAgentString() + " MariscalShopApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOfflinePage();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No se puede abrir la galería", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        createNotificationChannel();
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");

        String target = getIntent().getStringExtra(EXTRA_GOTO);
        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(target != null ? storeUrl + target : storeUrl);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String target = intent.getStringExtra(EXTRA_GOTO);
        if (target != null && webView != null) {
            webView.evaluateJavascript("location.hash='" + target.replace("'", "") + "'", null);
        }
    }

    // ---------------- Notificaciones ----------------

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Pedidos", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Avisos cuando tu pedido está listo y pedidos nuevos");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 300, 100, 300});
        ch.enableLights(true);
        ch.setLightColor(Color.GREEN);
        getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT >= 33) {
            return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    private void showNotification(String title, String body) {
        if (!notificationsAllowed()) return;
        Intent open = new Intent(this, MainActivity.class);
        open.putExtra(EXTRA_GOTO, "#/pedidos");
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_notification)
                .setColor(Color.parseColor("#0b6b2e"))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        getSystemService(NotificationManager.class).notify(notificationId++, b.build());
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIF_PERMISSION_REQUEST && webView != null) {
            webView.evaluateJavascript("window.onNotifPermission&&window.onNotifPermission()", null);
        }
    }

    /** Funciones que la tienda web puede llamar como window.AndroidBridge.xxx() */
    private class Bridge {
        @JavascriptInterface
        public void notifyUser(String title, String body) {
            runOnUiThread(() -> showNotification(title, body));
        }

        @JavascriptInterface
        public boolean hasPermission() {
            return notificationsAllowed();
        }

        @JavascriptInterface
        public void requestPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(() -> requestPermissions(
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIF_PERMISSION_REQUEST));
            }
        }
    }

    /** Las páginas de la tienda se abren aquí; WhatsApp, teléfono, etc. se abren afuera. */
    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();
        boolean web = scheme.equals("http") || scheme.equals("https");
        if (web && (host.equals(storeHost) || host.endsWith(".firebaseapp.com"))) return false;
        if (scheme.equals("about") || scheme.equals("data") || scheme.equals("blob")) return false;
        try {
            Intent intent = scheme.equals("intent")
                    ? Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                    : new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "No hay una app para abrir este enlace", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private void showOfflinePage() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style=\"font-family:sans-serif;text-align:center;padding:60px 24px;color:#17261c\">"
                + "<div style='font-size:64px'>📡</div><h2 style='color:#0b6b2e'>Sin conexión</h2>"
                + "<p>Revisa tu internet y vuelve a intentar.</p>"
                + "<a href='" + storeUrl + "' style='display:inline-block;margin-top:12px;background:#f5c400;color:#064a1f;"
                + "padding:12px 28px;border-radius:999px;font-weight:bold;text-decoration:none'>Reintentar</a></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.setVisibility(View.GONE);
            webView.destroy();
        }
        super.onDestroy();
    }
}
