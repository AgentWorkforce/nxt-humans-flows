import { readFileSync } from "node:fs";
import { normalize, type Design, type FigmaNodesResponse } from "../lib/figma.ts";

export const nodes = JSON.parse(readFileSync(new URL("../fixtures/figma-nodes.json", import.meta.url), "utf8")) as FigmaNodesResponse;
export const design = (): Design => ({ ...normalize(nodes, "FILE", "12:34"), images: { "ref-logo": "logo.png", "ref-hero": "hero.png" } });
