package ec.edu.mariscal.shop;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Recibe las notificaciones push de Firebase.
 * Con la app cerrada o en segundo plano, Android muestra la notificación solo;
 * este servicio se encarga de mostrarla cuando la app está abierta.
 */
public class PushService extends FirebaseMessagingService {

    static final String PREFS = "push";
    static final String KEY_TOKEN = "token";

    @Override
    public void onNewToken(@NonNull String token) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_TOKEN, token).apply();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        RemoteMessage.Notification n = msg.getNotification();
        if (n == null) return;
        String tag = msg.getData().get("tag");
        Notifier.show(this, n.getTitle(), n.getBody(), tag);
    }
}
