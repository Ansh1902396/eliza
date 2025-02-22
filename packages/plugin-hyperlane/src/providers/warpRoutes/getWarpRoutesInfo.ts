import { type IAgentRuntime, type Memory, type Provider } from "@elizaos/core";
import { GithubRegistry, IRegistry } from "@hyperlane-xyz/registry";

type WarpRouteInfoResult = Promise<
    {
        chain: string;
        symbol: string;
        routeId: string;
    }[]
>;

export async function _getWarpRoutesInfo(
    registry: IRegistry
): WarpRouteInfoResult {
    const routes = await registry.getWarpRoutes();
    return Object.entries(routes)
        .map(([routeId, config]) => {
            return config.tokens.map((token) => ({
                chain: token.chainName,
                symbol: token.symbol,
                routeId,
            }));
        })
        .flat();
}

const getWarpRoutesInfo: Provider = {
    async get(_runtime: IAgentRuntime, _message: Memory): WarpRouteInfoResult {
        const registry = new GithubRegistry();
        return await _getWarpRoutesInfo(registry);
    },
};

export default getWarpRoutesInfo;
