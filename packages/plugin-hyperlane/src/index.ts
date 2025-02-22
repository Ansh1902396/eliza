import { Plugin } from "@elizaos/core";
import { sendCrossChainMessage } from "./actions/sendCrossChainMsg";
import {
    getWarpRouteChains,
    getWarpRoutes,
    getWarpRoutesInfo,
} from "./providers";

export const hyperlanePlugin: Plugin = {
    name: "hyperlane plugin",
    description:
        "Provides core Hyperlane functionalities like sending cross-chain messaging, asset transfers, warp route deployments, permissionless hyperlane deployment to new chains.",
    actions: [sendCrossChainMessage],
    providers: [getWarpRoutes, getWarpRoutesInfo, getWarpRouteChains],
    evaluators: [],
    services: [],
};
