import { readFileSync } from 'node:fs';
import {
  parseGraphFromXmlText,
  type LoadGraphResult,
} from '../utils/graphXmlImport';

/**
 * Headless XML loader for simulation graphs.
 *
 * Thin wrapper over {@link parseGraphFromXmlText} so the CLI and Canvas share
 * a single parser. Accepts both the native `<diagram>` schema produced by
 * `serializeGraphElementsToXml` and the legacy Machinations `<graph>` schema
 * used by the official desktop examples.
 */
export type { LoadGraphResult };

/**
 * Parse a serialized graph XML string into a flat array of `GraphElement`s
 * suitable for `runSimulation` / `simulateTick`.
 */
export function loadGraphFromXml(xmlText: string): LoadGraphResult {
  return parseGraphFromXmlText(xmlText);
}

/**
 * Read a file from disk and parse it. Convenience wrapper for CLI / Node use.
 */
export function loadGraphFromFile(path: string): LoadGraphResult {
  return loadGraphFromXml(readFileSync(path, 'utf8'));
}
