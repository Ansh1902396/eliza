import fs from "fs";
import os from "os";
import path from "path";
import {
    DocumentOptions,
    LineCounter,
    ParseOptions,
    SchemaOptions,
    ToJSOptions,
    parse,
    stringify as yamlStringify,
} from "yaml";
import pino from "pino";

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

const yamlParse = (
    content: string,
    options?: ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions
) => parse(content, { maxAliasCount: -1, ...options });

export type FileFormat = "yaml" | "json";

function isFile(filepath: string) {
    if (!filepath) return false;
    try {
        return fs.existsSync(filepath) && fs.lstatSync(filepath).isFile();
    } catch (error) {
        logger.error({ path: filepath, error }, `Error checking if path is a file: ${filepath}`);
        return false;
    }
}

function isDirectory(dirpath: string) {
    if (!dirpath) return false;
    try {
        return fs.existsSync(dirpath) && fs.lstatSync(dirpath).isDirectory();
    } catch (error) {
        logger.error({ path: dirpath, error }, `Error checking if path is a directory: ${dirpath}`);
        return false;
    }
}

function readFileAtPath(filepath: string) {
    if (!isFile(filepath)) {
        logger.error({ path: filepath }, `File doesn't exist at ${filepath}`);
        throw Error(`File doesn't exist at ${filepath}`);
    }
    logger.debug({ path: filepath }, `Reading file: ${filepath}`);
    return fs.readFileSync(filepath, "utf8");
}

function writeFileAtPath(filepath: string, value: string) {
    const dirname = path.dirname(filepath);
    if (!isDirectory(dirname)) {
        logger.info({ path: dirname }, `Creating directory: ${dirname}`);
        fs.mkdirSync(dirname, { recursive: true });
    }
    logger.info({ path: filepath }, `Writing file: ${filepath}`);
    fs.writeFileSync(filepath, value);
}

function readJson<T>(filepath: string): T {
    logger.debug({ path: filepath }, `Reading JSON file: ${filepath}`);
    return JSON.parse(readFileAtPath(filepath)) as T;
}

function readYaml<T>(filepath: string): T {
    logger.debug({ path: filepath }, `Reading YAML file: ${filepath}`);
    return yamlParse(readFileAtPath(filepath)) as T;
}

function writeYaml(filepath: string, obj: any) {
    logger.info({ path: filepath }, `Writing YAML file: ${filepath}`);
    writeFileAtPath(
        filepath,
        yamlStringify(obj, { indent: 2, sortMapEntries: true }) + "\n"
    );
}

export function readYamlOrJson<T>(filepath: string, format?: FileFormat): T {
    logger.debug({ path: filepath, format }, `Reading YAML/JSON file: ${filepath}`);
    return resolveYamlOrJsonFn(filepath, readJson, readYaml, format);
}

export function writeYamlOrJson(
    filepath: string,
    obj: Record<string, any>,
    format?: FileFormat
) {
    logger.info({ path: filepath, format }, `Writing YAML/JSON file: ${filepath}`);
    return resolveYamlOrJsonFn(
        filepath,
        (f: string) => writeJson(f, obj),
        (f: string) => writeYaml(f, obj),
        format
    );
}

function writeJson(filepath: string, obj: any) {
    logger.info({ path: filepath }, `Writing JSON file: ${filepath}`);
    writeFileAtPath(filepath, JSON.stringify(obj, null, 2) + "\n");
}

function resolveYamlOrJsonFn(
    filepath: string,
    jsonFn: any,
    yamlFn: any,
    format?: FileFormat
) {
    const fileFormat = resolveFileFormat(filepath, format);
    if (!fileFormat) {
        logger.error({ path: filepath }, `Invalid file format for ${filepath}`);
        throw new Error(`Invalid file format for ${filepath}`);
    }

    if (fileFormat === "json") {
        return jsonFn(filepath);
    }

    return yamlFn(filepath);
}

function resolveFileFormat(
    filepath?: string,
    format?: FileFormat
): FileFormat | undefined {
    if (!filepath) {
        return format;
    }

    if (format === "json" || filepath?.endsWith(".json")) {
        return "json";
    }

    if (
        format === "yaml" ||
        filepath?.endsWith(".yaml") ||
        filepath?.endsWith(".yml")
    ) {
        return "yaml";
    }

    return undefined;
}
