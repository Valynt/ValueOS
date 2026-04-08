/**
 * Graph Export — Export graph data in various formats
 *
 * Phase 5.4: Value Graph Polish
 *
 * Provides SVG, PNG, JSON, and CSV export functionality.
 */

import { toSvg, toPng } from "html-to-image";

import type { Graph, ValueNode, ValueEdge } from "@/features/living-value-graph/types/graph.types";

/**
 * Export graph as SVG string.
 *
 * @param element — DOM element containing the graph visualization
 * @param options — Export options
 * @returns SVG string
 */
export async function exportGraphAsSvg(
  element: HTMLElement,
  options: {
    backgroundColor?: string;
    pixelRatio?: number;
  } = {}
): Promise<string> {
  const svgString = await toSvg(element, {
    backgroundColor: options.backgroundColor ?? "#ffffff",
    pixelRatio: options.pixelRatio ?? 2,
    skipFonts: false,
  });

  return svgString;
}

/**
 * Export graph as PNG blob.
 *
 * @param element — DOM element containing the graph visualization
 * @param options — Export options
 * @returns PNG blob
 */
export async function exportGraphAsPng(
  element: HTMLElement,
  options: {
    backgroundColor?: string;
    pixelRatio?: number;
    width?: number;
    height?: number;
  } = {}
): Promise<Blob> {
  const pngBlob = await toPng(element, {
    backgroundColor: options.backgroundColor ?? "#ffffff",
    pixelRatio: options.pixelRatio ?? 2,
    width: options.width,
    height: options.height,
    skipFonts: false,
    cacheBust: true,
  });

  // html-to-image returns a data URL, convert to blob
  const response = await fetch(pngBlob);
  return response.blob();
}

/**
 * Export graph data as JSON.
 *
 * @param graph — Graph data
 * @param options — Export options
 * @returns JSON string
 */
export function exportGraphAsJson(
  graph: Graph,
  options: {
    pretty?: boolean;
    includeMetadata?: boolean;
  } = {}
): string {
  const { pretty = true, includeMetadata = true } = options;

  const exportData = includeMetadata
    ? {
        ...graph,
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          version: "1.0",
        },
      }
    : graph;

  return pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}

/**
 * Export graph nodes as CSV.
 *
 * @param graph — Graph data
 * @returns CSV string
 */
export function exportGraphNodesAsCsv(graph: Graph): string {
  const nodes = Object.values(graph.nodes);
  if (nodes.length === 0) return "";

  // CSV header
  const headers = ["id", "type", "label", "value", "confidence", "owner", "description"];

  // CSV rows
  const rows = nodes.map((node) => [
    node.id,
    node.type,
    `"${node.label.replace(/"/g, '""')}"`,
    node.value ?? "",
    node.confidence ?? "",
    node.metadata?.owner ?? "",
    `"${(node.metadata?.description ?? "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Export graph edges as CSV.
 *
 * @param graph — Graph data
 * @returns CSV string
 */
export function exportGraphEdgesAsCsv(graph: Graph): string {
  const edges = Object.values(graph.edges);
  if (edges.length === 0) return "";

  // CSV header
  const headers = ["id", "source", "target", "type", "formula"];

  // CSV rows
  const rows = edges.map((edge) => [
    edge.id,
    edge.source,
    edge.target,
    edge.type,
    `"${(edge.formula ?? "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Export complete graph data as CSV (nodes + edges).
 *
 * @param graph — Graph data
 * @returns Object with nodes and edges CSV strings
 */
export function exportGraphData(
  graph: Graph,
  options: {
    format: "json" | "csv-nodes" | "csv-edges" | "csv-all";
  }
): { data: string; filename: string; mimeType: string } {
  const timestamp = new Date().toISOString().split("T")[0];

  switch (options.format) {
    case "json":
      return {
        data: exportGraphAsJson(graph),
        filename: `graph-${graph.id}-${timestamp}.json`,
        mimeType: "application/json",
      };

    case "csv-nodes":
      return {
        data: exportGraphNodesAsCsv(graph),
        filename: `graph-${graph.id}-nodes-${timestamp}.csv`,
        mimeType: "text/csv",
      };

    case "csv-edges":
      return {
        data: exportGraphEdgesAsCsv(graph),
        filename: `graph-${graph.id}-edges-${timestamp}.csv`,
        mimeType: "text/csv",
      };

    case "csv-all": {
      const nodesCsv = exportGraphNodesAsCsv(graph);
      const edgesCsv = exportGraphEdgesAsCsv(graph);
      return {
        data: `# Nodes\n${nodesCsv}\n\n# Edges\n${edgesCsv}`,
        filename: `graph-${graph.id}-${timestamp}.csv`,
        mimeType: "text/csv",
      };
    }

    default:
      throw new Error(`Unknown export format: ${options.format}`);
  }
}

/**
 * Download data as a file.
 *
 * @param data — Data to download
 * @param filename — Filename
 * @param mimeType — MIME type
 */
export function downloadFile(
  data: string | Blob,
  filename: string,
  mimeType: string
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export and download graph in the specified format.
 *
 * @param graph — Graph data
 * @param element — DOM element (for SVG/PNG exports)
 * @param format — Export format
 */
export async function exportAndDownloadGraph(
  graph: Graph,
  element: HTMLElement | null,
  format: "svg" | "png" | "json" | "csv-nodes" | "csv-edges" | "csv-all"
): Promise<void> {
  switch (format) {
    case "svg": {
      if (!element) throw new Error("Element required for SVG export");
      const svg = await exportGraphAsSvg(element);
      downloadFile(svg, `graph-${graph.id}.svg`, "image/svg+xml");
      break;
    }

    case "png": {
      if (!element) throw new Error("Element required for PNG export");
      const png = await exportGraphAsPng(element);
      downloadFile(png, `graph-${graph.id}.png`, "image/png");
      break;
    }

    case "json":
    case "csv-nodes":
    case "csv-edges":
    case "csv-all": {
      const { data, filename, mimeType } = exportGraphData(graph, {
        format,
      });
      downloadFile(data, filename, mimeType);
      break;
    }

    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}
