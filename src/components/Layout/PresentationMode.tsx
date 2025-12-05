import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize, Grid3x3 } from 'lucide-react';
import { CanvasComponent } from '../../types';
import { MetricCard } from '../Components/MetricCard';
import { InteractiveChart } from '../Components/InteractiveChart';
import { DataTable } from '../Components/DataTable';
import { NarrativeBlock } from '../Components/NarrativeBlock';

interface PresentationModeProps {
  isOpen: boolean;
  onClose: () => void;
  components: CanvasComponent[];
  caseName: string;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  isOpen,
  onClose,
  components,
  caseName
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentSlide < components.length - 1) {
        setCurrentSlide(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        setCurrentSlide(prev => prev - 1);
      } else if (e.key === 'g') {
        setShowGrid(!showGrid);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide, components.length, showGrid, onClose]);

  if (!isOpen) return null;

  const renderComponent = (component: CanvasComponent) => {
    const baseProps = {
      className: "w-full h-full flex items-center justify-center"
    };

    switch (component.type) {
      case 'metric-card':
        return (
          <div className="max-w-md mx-auto transform scale-150">
            <MetricCard {...component.props} />
          </div>
        );
      case 'interactive-chart':
        return (
          <div className="max-w-4xl mx-auto w-full">
            <InteractiveChart {...component.props} />
          </div>
        );
      case 'data-table':
        return (
          <div className="max-w-5xl mx-auto w-full">
            <DataTable {...component.props} />
          </div>
        );
      case 'narrative-block':
        return (
          <div className="max-w-3xl mx-auto transform scale-125">
            <NarrativeBlock {...component.props} />
          </div>
        );
      default:
        return null;
    }
  };

  if (showGrid) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-6 bg-gray-800 text-white">
            <h2 className="text-xl font-semibold">{caseName} - All Components</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowGrid(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Maximize className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-2 gap-8">
              {components.map((component, index) => (
                <button
                  key={component.id}
                  onClick={() => {
                    setCurrentSlide(index);
                    setShowGrid(false);
                  }}
                  className="bg-white rounded-xl p-6 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                >
                  <div className="transform scale-75 origin-top-left">
                    {renderComponent(component)}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">Slide {index + 1}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-6 bg-gray-800 text-white">
          <div>
            <h2 className="text-xl font-semibold">{caseName}</h2>
            <p className="text-sm text-gray-400 mt-1">
              Slide {currentSlide + 1} of {components.length}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowGrid(true)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Grid3x3 className="h-5 w-5" />
              <span>Grid View</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-12 bg-white">
          {renderComponent(components[currentSlide])}
        </div>

        <div className="flex items-center justify-between p-6 bg-gray-800 text-white">
          <button
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              currentSlide === 0
                ? 'text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            {components.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentSlide ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentSlide(prev => Math.min(components.length - 1, prev + 1))}
            disabled={currentSlide === components.length - 1}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              currentSlide === components.length - 1
                ? 'text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <span>Next</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 text-center text-gray-400 text-sm">
          <p>Use arrow keys to navigate • Press G for grid view • Esc to exit</p>
        </div>
      </div>
    </div>
  );
};
