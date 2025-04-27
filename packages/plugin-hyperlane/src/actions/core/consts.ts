import path from 'path';
import fs from 'fs';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export const MINIMUM_TEST_SEND_GAS = (3e5).toString();
export const EXPLORER_URL = "https://explorer.hyperlane.xyz";
export let CORE_CONFIG_FILE: string;
export let AGENT_CONFIG_FILE: string;
export let VALIDATOR_SIGNATURES_DIRECTORY: string;
export let VALIDATOR_DB_PATH: string;

// Ensure cache directory exists
function ensureCacheDir(chain: string): string {
    const cacheDir = path.join(process.cwd(), 'cache', chain);
    const configsDir = path.join(cacheDir, 'configs');
    
    if (!fs.existsSync(configsDir)) {
        logger.info({ path: configsDir }, `Creating config directory: ${configsDir}`);
        fs.mkdirSync(configsDir, { recursive: true });
    }
    
    return cacheDir;
}

export async function createConfigFilePath(chain: string): Promise<void> {
    const cacheDir = ensureCacheDir(chain);
    CORE_CONFIG_FILE = path.join(cacheDir, 'configs', 'core-config.yaml');
    logger.info({ path: CORE_CONFIG_FILE }, `Core config file path set to: ${CORE_CONFIG_FILE}`);
}

export async function createAgentConfigFilePath(chain: string): Promise<void> {
    const cacheDir = ensureCacheDir(chain);
    AGENT_CONFIG_FILE = path.join(cacheDir, 'configs', 'agent-config.json');
    logger.info({ path: AGENT_CONFIG_FILE }, `Agent config file path set to: ${AGENT_CONFIG_FILE}`);
}

export async function createValidatorSignaturesDir(
    chain: string
): Promise<void> {
    const cacheDir = ensureCacheDir(chain);
    VALIDATOR_SIGNATURES_DIRECTORY = path.join(cacheDir, 'validator-signatures');
    
    if (!fs.existsSync(VALIDATOR_SIGNATURES_DIRECTORY)) {
        logger.info({ path: VALIDATOR_SIGNATURES_DIRECTORY }, `Creating validator signatures directory: ${VALIDATOR_SIGNATURES_DIRECTORY}`);
        fs.mkdirSync(VALIDATOR_SIGNATURES_DIRECTORY, { recursive: true });
    }
    
    logger.info({ path: VALIDATOR_SIGNATURES_DIRECTORY }, `Validator signatures directory set to: ${VALIDATOR_SIGNATURES_DIRECTORY}`);
}

export async function createValidatorDbPath(chain: string): Promise<void> {
    const cacheDir = ensureCacheDir(chain);
    VALIDATOR_DB_PATH = path.join(cacheDir, 'validator-db');
    
    if (!fs.existsSync(VALIDATOR_DB_PATH)) {
        logger.info({ path: VALIDATOR_DB_PATH }, `Creating validator DB directory: ${VALIDATOR_DB_PATH}`);
        fs.mkdirSync(VALIDATOR_DB_PATH, { recursive: true });
    }
    
    logger.info({ path: VALIDATOR_DB_PATH }, `Validator DB path set to: ${VALIDATOR_DB_PATH}`);
}
