// /workspaces/ValueOS/apps/ValyntApp/src/components/DetailHeader.tsx
import React from "react";
import { Edit, MoreVertical } from "lucide-react";

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  actions?: React.ReactNode;
}

const DetailHeader: React.FC<DetailHeaderProps> = ({ title, subtitle, onEdit, actions }) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
      <div className="flex space-x-2">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            aria-label="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
};

export default DetailHeader;
