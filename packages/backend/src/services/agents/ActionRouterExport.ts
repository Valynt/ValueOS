import { ActionContext, ActionResult, CanonicalAction } from '@valueos/shared/types/actions';

import {
  downloadBlob,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToPNG,
  generateFilename,
} from '../../utils/export';
import { workspaceStateService } from '../WorkspaceStateService.js';

export async function handleExportAction(
  action: CanonicalAction,
  context: ActionContext
): Promise<ActionResult> {
  if (action.type !== 'exportArtifact') {
    return { success: false, error: 'Invalid action type' };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      success: false,
      error: 'Export is only supported in browser environment',
    };
  }

  try {
    const { artifactType, format } = action;
    const extension = format === 'excel' ? 'xlsx' : format;
    const filename = generateFilename(artifactType, extension);
    let blob: Blob;

    if (format === 'pdf') {
      blob = await exportToPDF({ artifactType }, { filename });
    } else if (format === 'png') {
      blob = await exportToPNG(artifactType, { filename });
    } else if (format === 'excel' || format === 'csv') {
      const workspaceId = context.workspaceId ?? '';
      const state = await workspaceStateService.getState(workspaceId);
      let dataToExport: unknown[] = [];

      if (state.data && state.data[artifactType]) {
        const targetData = state.data[artifactType];
        dataToExport = Array.isArray(targetData) ? targetData : [targetData];
      } else if (state.data && Object.keys(state.data).length > 0) {
        dataToExport = [state.data];
      } else {
        return { success: false, error: `No data found for artifact type: ${artifactType}` };
      }

      if (format === 'csv') {
        const csvContent = exportToCSV(dataToExport);
        blob = new Blob([csvContent], { type: 'text/csv' });
      } else {
        blob = await exportToExcel(dataToExport, { sheetName: artifactType });
      }
    } else {
      return { success: false, error: `Unsupported format: ${format}` };
    }

    downloadBlob(blob, filename);

    return {
      success: true,
      data: { artifactType, format, exported: true, filename },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
