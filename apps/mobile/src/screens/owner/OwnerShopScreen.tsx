import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { RazorpayCheckoutModal } from "../../components/shop/RazorpayCheckoutModal";
import { loadStoreCart, saveStoreCart } from "../../lib/cart-storage";
import { DELIVERY_CITIES, type DeliveryCityValue } from "../../lib/delivery-cities";
import { supabase } from "../../lib/supabase";
import { confirmStoreCheckout, createStoreRazorpayOrder, getWebsiteBaseUrl } from "../../lib/store-api";
import { commonStyles } from "../../theme/commonStyles";
import { shadows, theme } from "../../theme/theme";
import type { Order, ProductListItem, StoreCartLine } from "../../types/app";

function previewText(p: ProductListItem): string | null {
  const s = (p.summary || p.description || "").trim();
  if (!s) return null;
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function addToCartLine(cart: StoreCartLine[], p: ProductListItem): StoreCartLine[] {
  const i = cart.findIndex((c) => c.productId === p.id);
  if (i >= 0) {
    const next = [...cart];
    const max = p.stock_quantity;
    if (next[i].quantity >= max) return cart;
    next[i] = { ...next[i], quantity: next[i].quantity + 1 };
    return next;
  }
  return [
    ...cart,
    {
      productId: p.id,
      name: p.name,
      price: Number(p.price),
      quantity: 1,
      image_url: p.image_url,
    },
  ];
}

function cartSubtotal(cart: StoreCartLine[]) {
  return cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

function cartCount(cart: StoreCartLine[]) {
  return cart.reduce((n, l) => n + l.quantity, 0);
}

export function OwnerShopScreen({
  orders,
  products,
  refreshing,
  onRefresh,
}: {
  orders: Order[];
  products: ProductListItem[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const baseUrl = getWebsiteBaseUrl();

  const [cart, setCart] = useState<StoreCartLine[]>([]);
  const [search, setSearch] = useState("");
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [line1, setLine1] = useState("");
  const [city, setCity] = useState<DeliveryCityValue>("chandigarh");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");

  const [rzOpen, setRzOpen] = useState(false);
  const [rzKeyId, setRzKeyId] = useState("");
  const [rzOrderId, setRzOrderId] = useState("");
  const [rzAmountPaise, setRzAmountPaise] = useState(0);

  useEffect(() => {
    loadStoreCart().then(setCart);
  }, []);

  const persistCart = useCallback(async (next: StoreCartLine[]) => {
    setCart(next);
    await saveStoreCart(next);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const colGap = 12;
  const hPad = 16;
  const cardW = (width - hPad * 2 - colGap) / 2;

  const onAdd = useCallback(
    (p: ProductListItem) => {
      if (p.stock_quantity <= 0) return;
      void persistCart(addToCartLine(cart, p));
    },
    [cart, persistCart],
  );

  const updateQty = useCallback(
    (productId: string, quantity: number) => {
      if (quantity < 1) {
        void persistCart(cart.filter((c) => c.productId !== productId));
        return;
      }
      const p = products.find((x) => x.id === productId);
      const max = p?.stock_quantity ?? quantity;
      const q = Math.min(quantity, max);
      void persistCart(cart.map((c) => (c.productId === productId ? { ...c, quantity: q } : c)));
    },
    [cart, products, persistCart],
  );

  const startCheckoutFlow = useCallback(async () => {
    if (!baseUrl) {
      Alert.alert("Website URL missing", "Set EXPO_PUBLIC_WEBSITE_URL to your marketing site (same app as the web store).");
      return;
    }
    if (!cart.length) return;
    setCartModalOpen(false);
    setCheckoutOpen(true);
  }, [baseUrl, cart.length]);

  const payWithRazorpay = useCallback(async () => {
    if (!baseUrl) return;
    if (!line1.trim()) {
      Alert.alert("Address", "Enter street / building.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Phone", "Enter a contact number.");
      return;
    }

    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        Alert.alert("Session", "Please sign in again.");
        return;
      }

      const items = cart.map((l) => ({ product_id: l.productId, quantity: l.quantity }));
      const created = await createStoreRazorpayOrder(baseUrl, token, items);
      if (created.paymentMode === "test") {
        Alert.alert(
          "Test payment",
          "Razorpay is in test mode. Use test cards / UPI from the Razorpay dashboard — no real money is charged.",
        );
      }
      setRzKeyId(created.keyId);
      setRzOrderId(created.razorpayOrderId);
      setRzAmountPaise(created.amountPaise);
      setCheckoutOpen(false);
      setRzOpen(true);
    } catch (e) {
      Alert.alert("Payment", e instanceof Error ? e.message : "Could not start payment.");
    } finally {
      setBusy(false);
    }
  }, [baseUrl, cart, line1, phone]);

  const onRazorpayPaid = useCallback(
    async (payload: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
      if (!baseUrl) return;
      setBusy(true);
      setRzOpen(false);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Session expired.");

        const items = cart.map((l) => ({ product_id: l.productId, quantity: l.quantity }));
        await confirmStoreCheckout(baseUrl, token, {
          items,
          razorpayOrderId: payload.razorpay_order_id,
          razorpayPaymentId: payload.razorpay_payment_id,
          razorpaySignature: payload.razorpay_signature,
          shippingAddress: {
            line1: line1.trim(),
            city,
            state: "Punjab / Haryana",
            postalCode: postalCode.trim(),
            country: "India",
            phone: phone.trim(),
          },
        });

        await persistCart([]);
        setLine1("");
        setPostalCode("");
        setPhone("");
        Alert.alert("Order placed", "Payment successful. Thank you!");
        onRefresh();
      } catch (e) {
        Alert.alert("Checkout", e instanceof Error ? e.message : "Could not confirm order.");
      } finally {
        setBusy(false);
      }
    },
    [baseUrl, cart, city, line1, phone, postalCode, persistCart, onRefresh],
  );

  const renderProduct = useCallback(
    ({ item: p }: { item: ProductListItem }) => {
      const blurb = previewText(p);
      const inStock = p.stock_quantity > 0;
      const compare = p.compare_at_price != null ? Number(p.compare_at_price) : null;
      const showCompare = compare != null && compare > Number(p.price);
      return (
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.cardImageWrap}>
            {p.image_url ? (
              <Image source={{ uri: p.image_url }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePh]}>
                <MaterialIcons name="shopping-bag" size={40} color={theme.outline} />
              </View>
            )}
            {p.requires_prescription ? (
              <View style={styles.badgeRx}>
                <Text style={styles.badgeRxText}>Rx</Text>
              </View>
            ) : (
              <View style={styles.badgeOtc}>
                <Text style={styles.badgeOtcText}>OTC</Text>
              </View>
            )}
            {!inStock ? (
              <View style={styles.soldOut}>
                <Text style={styles.soldOutText}>Out of stock</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {p.name}
            </Text>
            {blurb ? (
              <Text style={styles.cardBlurb} numberOfLines={2}>
                {blurb}
              </Text>
            ) : null}
            <View style={styles.cardPriceRow}>
              <Text style={styles.cardPrice}>₹{Number(p.price).toFixed(0)}</Text>
              {showCompare ? <Text style={styles.cardCompare}>₹{compare!.toFixed(0)}</Text> : null}
            </View>
            <Pressable
              style={[styles.addBtn, !inStock && styles.addBtnDisabled]}
              onPress={() => onAdd(p)}
              disabled={!inStock}
            >
              <Text style={styles.addBtnText}>{inStock ? "Add to cart" : "Unavailable"}</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [cardW, onAdd],
  );

  const cartBarBottom = Math.max(tabBarHeight, 8);

  const listHeader = (
    <View>
      {!baseUrl ? (
        <View style={styles.warnBanner}>
          <MaterialIcons name="warning" size={18} color="#92400e" />
          <Text style={styles.warnText}>
            Set <Text style={{ fontWeight: "800" }}>EXPO_PUBLIC_WEBSITE_URL</Text> for checkout (your Next.js store URL).
          </Text>
        </View>
      ) : null}
      <View style={styles.headerBlock}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>Shop</Text>
            <Text style={styles.heroTitle}>Browse products</Text>
            <Text style={styles.heroSub}>Same catalog as the clinic website. Secure Razorpay checkout (test keys = test mode).</Text>
          </View>
          <Pressable style={styles.cartFab} onPress={() => setCartModalOpen(true)} accessibilityLabel="Open cart">
            <MaterialIcons name="shopping-cart" size={26} color={theme.onPrimary} />
            {cartCount(cart) > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount(cart) > 99 ? "99+" : cartCount(cart)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={22} color={theme.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products"
            placeholderTextColor={theme.outline}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>
    </View>
  );

  const listFooter = (
    <View style={{ paddingBottom: 24, paddingHorizontal: 16 }}>
      <View style={[commonStyles.card, { marginHorizontal: 0, marginTop: 16 }]}>
        <Text style={commonStyles.cardTitle}>Orders</Text>
        {orders.map((o) => (
          <View key={o.id} style={styles.orderRow}>
            <View style={commonStyles.pill}>
              <Text style={commonStyles.pillText}>{o.status}</Text>
            </View>
            <Text style={styles.orderTotal}>₹{Number(o.grand_total).toFixed(2)}</Text>
          </View>
        ))}
        {!orders.length ? <Text style={commonStyles.emptyState}>No orders yet.</Text> : null}
      </View>
      <View style={[styles.aiCard, { marginHorizontal: 0, marginTop: 12 }]}>
        <MaterialIcons name="upload-file" size={22} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.aiTitle}>Prescription items</Text>
          <Text style={styles.aiBody}>For Rx products, keep prescriptions ready — your clinic may verify before dispatch.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screenRoot}>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.colWrap}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        renderItem={renderProduct}
        contentContainerStyle={[styles.listContent, { paddingBottom: cart.length ? cartBarBottom + 88 : 32 }]}
        ListEmptyComponent={
          <Text style={commonStyles.emptyState}>{products.length ? "No matches." : "No products listed for this clinic yet."}</Text>
        }
      />

      {cart.length > 0 ? (
        <View style={[styles.cartBar, { paddingBottom: cartBarBottom }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cartBarLabel}>Subtotal</Text>
            <Text style={styles.cartBarTotal}>₹{cartSubtotal(cart).toFixed(0)}</Text>
          </View>
          <Pressable style={styles.cartBarBtn} onPress={startCheckoutFlow} disabled={!baseUrl}>
            <Text style={styles.cartBarBtnText}>Checkout</Text>
            <MaterialIcons name="arrow-forward" size={20} color={theme.onPrimary} />
          </Pressable>
        </View>
      ) : null}

      <Modal visible={cartModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCartModalOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cart</Text>
            <Pressable onPress={() => setCartModalOpen(false)} accessibilityLabel="Close cart">
              <MaterialIcons name="close" size={28} color={theme.onSurface} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 32 }}>
            {cart.map((line) => (
              <View key={line.productId} style={styles.cartLine}>
                {line.image_url ? (
                  <Image source={{ uri: line.image_url }} style={styles.cartThumb} />
                ) : (
                  <View style={[styles.cartThumb, styles.cartThumbPh]}>
                    <MaterialIcons name="image" size={22} color={theme.outline} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.cartLinePrice}>₹{line.price.toFixed(0)} each</Text>
                  <View style={styles.qtyRow}>
                    <Pressable onPress={() => updateQty(line.productId, line.quantity - 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyVal}>{line.quantity}</Text>
                    <Pressable onPress={() => updateQty(line.productId, line.quantity + 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.cartLineSum}>₹{(line.price * line.quantity).toFixed(0)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Text style={styles.modalSub}>₹{cartSubtotal(cart).toFixed(0)}</Text>
            <Pressable style={styles.modalCta} onPress={startCheckoutFlow} disabled={!baseUrl}>
              <Text style={styles.modalCtaText}>Proceed to checkout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={checkoutOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCheckoutOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery</Text>
              <Pressable onPress={() => setCheckoutOpen(false)}>
                <MaterialIcons name="close" size={28} color={theme.onSurface} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Street / building</Text>
              <TextInput style={styles.field} value={line1} onChangeText={setLine1} placeholder="House no., street" />
              <Text style={styles.fieldLabel}>City</Text>
              <View style={styles.cityRow}>
                {DELIVERY_CITIES.map((c) => (
                  <Pressable
                    key={c.value}
                    onPress={() => setCity(c.value)}
                    style={[styles.cityChip, city === c.value && styles.cityChipOn]}
                  >
                    <Text style={[styles.cityChipText, city === c.value && styles.cityChipTextOn]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>PIN code</Text>
              <TextInput style={styles.field} value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.field} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Text style={styles.hint}>Tricity delivery only — same rules as the website.</Text>
            </ScrollView>
            <View style={styles.modalFooter}>
              {busy ? <ActivityIndicator color={theme.primary} /> : null}
              <Pressable style={[styles.modalCta, busy && { opacity: 0.7 }]} onPress={payWithRazorpay} disabled={busy}>
                <Text style={styles.modalCtaText}>Pay with Razorpay</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <RazorpayCheckoutModal
        visible={rzOpen}
        keyId={rzKeyId}
        orderId={rzOrderId}
        amountPaise={rzAmountPaise}
        onPaid={onRazorpayPaid}
        onDismiss={() => setRzOpen(false)}
        onError={(msg) => Alert.alert("Payment", msg)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: theme.surface },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
  },
  warnText: { flex: 1, color: "#92400e", fontSize: 13, lineHeight: 18 },
  headerBlock: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: theme.primary, textTransform: "uppercase" },
  heroTitle: { fontSize: 24, fontWeight: "800", color: theme.onSurface, marginTop: 4 },
  heroSub: { fontSize: 13, color: theme.onSurfaceVariant, marginTop: 6, lineHeight: 18, paddingRight: 8 },
  cartFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.fab,
  },
  cartBadge: {
    position: "absolute",
    right: -2,
    top: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceBright,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: theme.onSurface },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  colWrap: { justifyContent: "space-between", marginBottom: 12 },
  card: {
    marginBottom: 0,
    borderRadius: 16,
    backgroundColor: theme.surfaceBright,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    overflow: "hidden",
  },
  cardImageWrap: {
    aspectRatio: 1,
    backgroundColor: theme.surfaceContainerHigh,
    position: "relative",
  },
  cardImage: { width: "100%", height: "100%" },
  cardImagePh: { alignItems: "center", justifyContent: "center" },
  badgeRx: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeRxText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  badgeOtc: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeOtcText: { color: theme.onSurfaceVariant, fontSize: 10, fontWeight: "800" },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOutText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  cardBody: { padding: 12 },
  cardTitle: { fontWeight: "800", fontSize: 14, color: theme.onSurface, minHeight: 40 },
  cardBlurb: { fontSize: 12, color: theme.onSurfaceVariant, marginTop: 4, lineHeight: 16 },
  cardPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
  cardPrice: { fontSize: 18, fontWeight: "800", color: theme.primary },
  cardCompare: { fontSize: 13, color: theme.onSurfaceVariant, textDecorationLine: "line-through" },
  addBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.primary,
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 14 },
  cartBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.surfaceBright,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
    gap: 12,
  },
  cartBarLabel: { fontSize: 12, color: theme.onSurfaceVariant, fontWeight: "600" },
  cartBarTotal: { fontSize: 20, fontWeight: "800", color: theme.onSurface },
  cartBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  cartBarBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  modalRoot: { flex: 1, backgroundColor: theme.surface },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: theme.onSurface },
  modalScroll: { flex: 1, paddingHorizontal: 16 },
  cartLine: { flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant },
  cartThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: theme.surfaceContainerHigh },
  cartThumbPh: { alignItems: "center", justifyContent: "center" },
  cartLineName: { fontWeight: "700", color: theme.onSurface, fontSize: 15 },
  cartLinePrice: { fontSize: 12, color: theme.onSurfaceVariant, marginTop: 2 },
  cartLineSum: { fontWeight: "800", color: theme.onSurface },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 18, fontWeight: "700", color: theme.onSurface },
  qtyVal: { fontWeight: "800", fontSize: 16, minWidth: 24, textAlign: "center" },
  modalFooter: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
    gap: 12,
  },
  modalSub: { fontSize: 22, fontWeight: "800", textAlign: "right", color: theme.onSurface },
  modalCta: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  modalCtaText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: theme.onSurfaceVariant, marginTop: 12 },
  field: {
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 6,
    fontSize: 16,
    color: theme.onSurface,
  },
  cityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceBright,
  },
  cityChipOn: { borderColor: theme.primary, backgroundColor: "rgba(13,148,136,0.12)" },
  cityChipText: { fontSize: 12, fontWeight: "600", color: theme.onSurface },
  cityChipTextOn: { color: theme.primary },
  hint: { fontSize: 12, color: theme.onSurfaceVariant, marginTop: 16, lineHeight: 18 },
  orderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  orderTotal: { fontWeight: "700", color: theme.onSurface },
  aiCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 14,
    backgroundColor: theme.surfaceContainerLow,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  aiTitle: { fontWeight: "800", color: theme.onSurface },
  aiBody: { color: theme.onSurfaceVariant, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
