import {ChainName , CoreConfig } from "@hyperlane-xyz/sdk";
import { WriteCommandContext } from "../core/context";

export interface DeployParams  {
    context : WriteCommandContext,
    chain : ChainName,
    config : CoreConfig
}
