import { assetTransferPlugin } from "./plugins/assetTransfer";
import { crossChainMessagingPlugin } from "./plugins/crossChainMessaging";
import { deployHyperlanePlugin } from "./plugins/deployHyperlane";
import { deployWarpRoutePlugin } from "./plugins/deployWarpRoute";

export const plugins = {
    crossChainMessagingPlugin,
    assetTransferPlugin,
    deployWarpRoutePlugin,
    deployHyperlanePlugin,
};

export * from "./plugins/crossChainMessaging";
export * from "./plugins/assetTransfer";
export * from "./plugins/deployWarpRoute";
export * from "./plugins/deployHyperlane";