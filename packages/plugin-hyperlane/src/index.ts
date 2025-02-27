import { Plugin } from "@elizaos/core";

import {
    getWarpRouteChains,
    getWarpRoutes,
    getWarpRoutesInfo,
} from "./providers";

import {
    deployWarpRoute,
    setUpHyperlaneAgent,
    sendCrossChainMessage,
    transferCrossChainAsset,
} from "./actions";


export const hyperlanePlugin: Plugin = {
    name: "hyperlane plugin",
    description:
        "Provides core Hyperlane functionalities like sending cross-chain messaging, asset transfers, warp route deployments, permissionless hyperlane deployment to new chains.",
    actions: [sendCrossChainMessage , transferCrossChainAsset , deployWarpRoute , setUpHyperlaneAgent],
    providers: [getWarpRoutes, getWarpRoutesInfo, getWarpRouteChains],
    evaluators: [],
    services: [],
};
