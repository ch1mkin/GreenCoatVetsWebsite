import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../../theme/theme";

function buildCheckoutHtml(keyId: string, amountPaise: number, orderId: string): string {
  const k = JSON.stringify(keyId);
  const o = JSON.stringify(orderId);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>body{margin:0;background:#0f766e;font-family:system-ui,sans-serif;}#m{color:#fff;padding:20px;text-align:center;}</style>
</head>
<body>
  <div id="m">Opening secure payment…</div>
  <script>
    (function() {
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = function() {
        var options = {
          key: ${k},
          amount: ${amountPaise},
          currency: 'INR',
          order_id: ${o},
          name: 'Clinic store',
          description: 'Pet care products',
          handler: function(r) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                ok: true,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_order_id: r.razorpay_order_id,
                razorpay_signature: r.razorpay_signature
              }));
            }
          },
          theme: { color: '#0d9488' },
          modal: {
            ondismiss: function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, dismissed: true }));
              }
            }
          }
        };
        try {
          var el = document.getElementById('m');
          if (el) el.style.display = 'none';
          var rzp = new Razorpay(options);
          rzp.open();
        } catch (e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, error: String(e) }));
          }
        }
      };
      s.onerror = function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, error: 'Could not load Razorpay.' }));
        }
      };
      document.body.appendChild(s);
    })();
  </script>
</body>
</html>`;
}

export function RazorpayCheckoutModal({
  visible,
  keyId,
  orderId,
  amountPaise,
  onPaid,
  onDismiss,
  onError,
}: {
  visible: boolean;
  keyId: string;
  orderId: string;
  amountPaise: number;
  onPaid: (payload: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}) {
  const html = visible && keyId && orderId && amountPaise > 0 ? buildCheckoutHtml(keyId, amountPaise, orderId) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={styles.wrap}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>Secure payment</Text>
          <Pressable onPress={onDismiss} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        {html ? (
          <WebView
            key={`${orderId}-${amountPaise}`}
            style={styles.web}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            source={{ html }}
            onMessage={(e: { nativeEvent: { data: string } }) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data) as Record<string, unknown>;
                if (msg.ok === true && typeof msg.razorpay_payment_id === "string") {
                  onPaid({
                    razorpay_payment_id: msg.razorpay_payment_id,
                    razorpay_order_id: String(msg.razorpay_order_id ?? ""),
                    razorpay_signature: String(msg.razorpay_signature ?? ""),
                  });
                  return;
                }
                if (msg.dismissed === true) onDismiss();
                else if (typeof msg.error === "string") onError(msg.error);
              } catch {
                onError("Invalid payment response.");
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            )}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.surface },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
    backgroundColor: theme.surfaceBright,
  },
  toolbarTitle: { fontWeight: "800", fontSize: 17, color: theme.onSurface },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  closeText: { color: theme.primary, fontWeight: "700", fontSize: 16 },
  web: { flex: 1, backgroundColor: "#fff" },
  loading: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
});
