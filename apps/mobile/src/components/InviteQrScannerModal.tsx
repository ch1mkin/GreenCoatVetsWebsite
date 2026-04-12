import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { extractInviteTokenFromPayload } from "../lib/inviteQr";
import { theme } from "../theme/theme";
import { PawCircularLoader } from "./PawCircularLoader";

type Props = {
  visible: boolean;
  onClose: () => void;
  onToken: (token: string) => void;
};

export function InviteQrScannerModal({ visible, onClose, onToken }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const handleBarcode = useCallback(
    (e: { data: string }) => {
      if (scannedRef.current) return;
      const token = extractInviteTokenFromPayload(e.data);
      if (!token || token.length < 6) return;
      scannedRef.current = true;
      onToken(token);
      onClose();
    },
    [onClose, onToken]
  );

  const openPermission = async () => {
    scannedRef.current = false;
    await requestPermission();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={() => {
        scannedRef.current = false;
      }}
    >
      <SafeAreaView style={styles.wrap} edges={["top", "left", "right"]}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => {
              scannedRef.current = false;
              onClose();
            }}
            style={styles.closeBtn}
          >
            <MaterialIcons name="close" size={26} color={theme.onSurface} />
          </Pressable>
          <Text style={styles.toolbarTitle}>Scan invite QR</Text>
          <View style={{ width: 40 }} />
        </View>

        {!permission ? (
          <View style={styles.center}>
            <PawCircularLoader size={56} message="Checking camera…" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.hint}>Camera access is needed to scan clinic invite QR codes.</Text>
            <Pressable style={styles.primaryBtn} onPress={openPermission}>
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcode}
          />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerHint}>Point the camera at the QR from your clinic.</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.background,
  },
  closeBtn: { padding: 8 },
  toolbarTitle: { fontWeight: "800", fontSize: 16, color: theme.onSurface },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  hint: { color: theme.onSurfaceVariant, textAlign: "center", fontSize: 15 },
  primaryBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  footer: { padding: 16, backgroundColor: theme.background },
  footerHint: { textAlign: "center", color: theme.outline, fontSize: 13 },
});
