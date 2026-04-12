declare module "react-native-webview" {
  import type { Component, ReactNode } from "react";
  import type { ViewProps } from "react-native";

  export interface WebViewProps extends ViewProps {
    source?: { uri?: string; html?: string; baseUrl?: string };
    originWhitelist?: string[];
    javaScriptEnabled?: boolean;
    domStorageEnabled?: boolean;
    mixedContentMode?: "never" | "always" | "compatibility";
    onMessage?: (event: { nativeEvent: { data: string } }) => void;
    startInLoadingState?: boolean;
    renderLoading?: () => ReactNode;
  }

  export class WebView extends Component<WebViewProps> {}
}
