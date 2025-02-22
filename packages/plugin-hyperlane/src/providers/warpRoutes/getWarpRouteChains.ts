import { type IAgentRuntime, type Memory, type Provider } from "@elizaos/core";
import { GithubRegistry, IRegistry } from "@hyperlane-xyz/registry";

export async function _getWarpRouteChains(
    registry: IRegistry
): Promise<string[]> {
    return await registry.getChains();
}

const getWarpRouteChains: Provider = {
    async get(_runtime: IAgentRuntime, _message: Memory): Promise<string[]> {
        const registry = new GithubRegistry();
        return await _getWarpRouteChains(registry);
    },
};

export default getWarpRouteChains;
