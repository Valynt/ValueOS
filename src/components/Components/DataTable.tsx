import React, { useState } from 'react';
import { DataTableProps } from '../../types';
import { CreditCard as Edit3, Check, X } from 'lucide-react';

export const DataTable: React.FC<DataTableProps> = ({
  title,
  headers,
  rows,
  editableColumns = []
}) => {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [tableRows, setTableRows] = useState(rows);

  const startEditing = (rowIndex: number, colIndex: number) => {
    if (!editableColumns.includes(colIndex)) return;
    
    setEditingCell({ row: rowIndex, col: colIndex });
    setEditValue(String(tableRows[rowIndex][colIndex]));
  };

  const saveEdit = () => {
    if (!editingCell) return;
    
    const newRows = [...tableRows];
    newRows[editingCell.row][editingCell.col] = editValue;
    setTableRows(newRows);
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      
      <div className="overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                  {editableColumns.includes(index) && (
                    <Edit3 className="inline-block h-3 w-3 ml-1 text-blue-500" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, colIndex) => (
                  <td 
                    key={colIndex}
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      editableColumns.includes(colIndex) 
                        ? 'cursor-pointer hover:bg-blue-50' 
                        : ''
                    }`}
                    onClick={() => startEditing(rowIndex, colIndex)}
                  >
                    {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyPress}
                          className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="p-1 text-green-600 hover:text-green-800"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group">
                        <span className={colIndex === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}>
                          {cell}
                        </span>
                        {editableColumns.includes(colIndex) && (
                          <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};