package ec.edu.mariscal.shop;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;

/** Crea el canal "Pedidos" y muestra notificaciones del sistema. */
final class Notifier {

    static final String CHANNEL_ID = "pedidos";
    static final String EXTRA_GOTO = "goto";

    private Notifier() {}

    static void createChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Pedidos", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Avisos cuando tu pedido está listo y pedidos nuevos");
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 300, 100, 300});
        ch.enableLights(true);
        ch.setLightColor(Color.GREEN);
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    static boolean allowed(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33) {
            return ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return ctx.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    /**
     * Muestra una notificación. Con el mismo tag reemplaza a la anterior, así un
     * aviso local y uno push del mismo pedido no se duplican.
     */
    static void show(Context ctx, String title, String body, String tag) {
        if (!allowed(ctx)) return;
        createChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        open.putExtra(EXTRA_GOTO, "#/pedidos");
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(ctx, CHANNEL_ID)
                : new Notification.Builder(ctx);
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
        String t = (tag == null || tag.isEmpty()) ? "aviso-" + System.currentTimeMillis() : tag;
        ctx.getSystemService(NotificationManager.class).notify(t, 0, b.build());
    }
}
