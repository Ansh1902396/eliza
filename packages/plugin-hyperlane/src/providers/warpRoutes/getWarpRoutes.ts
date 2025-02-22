import { type IAgentRuntime, type Memory, type Provider } from "@elizaos/core";
import { GithubRegistry, IRegistry } from "@hyperlane-xyz/registry";

export async function _getWarpRoutes(registry: IRegistry): Promise<string[]> {
    const routes = await registry.getWarpRoutes();
    return Object.keys(routes);
}

const getWarpRoutes: Provider = {
    async get(_runtime: IAgentRuntime, _message: Memory): Promise<string[]> {
        const registry = new GithubRegistry();
        return await _getWarpRoutes(registry);
    },
};

export default getWarpRoutes;
