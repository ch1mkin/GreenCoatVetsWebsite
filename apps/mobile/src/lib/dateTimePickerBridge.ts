import { Platform } from "react-native";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";

/**
 * Safe handler for @react-native-community/datetimepicker on Android 13+ / RN 0.83+.
 * Avoids internal "dismiss" errors when the dialog closes; use instead of raw `onChange`.
 */
export function handleDateTimePickerChange(
  event: DateTimePickerEvent,
  selected: Date | undefined,
  opts: {
    onSet: (date: Date) => void;
    setVisible: (visible: boolean) => void;
  },
): void {
  if (Platform.OS === "android") {
    opts.setVisible(false);
  }
  const evType = "type" in event ? event.type : "set";
  if (evType === "dismissed") {
    if (Platform.OS === "ios") opts.setVisible(false);
    return;
  }
  if (selected) {
    opts.onSet(selected);
  }
  if (Platform.OS === "ios") {
    opts.setVisible(false);
  }
}
