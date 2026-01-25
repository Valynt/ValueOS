/**
 * ValueCanvas - Interactive canvas for value driver configuration
 * 
 * Features:
 * - Drag-and-drop value drivers from library
 * - Real-time calculation updates
 * - Auto-save to playground session
 * - Tenant-scoped operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { DndProvider } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ValueDriverCard } from './ValueDriverCard';
import { ValueDriverEditor } from '../valueDrivers/ValueDriverEditor';
import { calculationEngine } from '@/services/CalculationEngine';
import { PlaygroundSessionService } from '@/services/PlaygroundSessionService';
import { useOrganization } from '@/hooks/useOrganization';
import { ValueDriver, CanvasComponent } from '@/types/valueDriver';
import { logger } from '@/lib/logger';

interface ValueCanvasProps {
  sessionId: string;
  onSave: () => void;
}

export const ValueCanvas: React.FC<ValueCanvasProps> = ({ sessionId, onSave }) => {
  const { organizationId } = useOrganization();
  const [drivers, setDrivers] = useState<ValueDriver[]>([]);
  const [canvasComponents, setCanvasComponents] = useState<CanvasComponent[]>([]);
  const [editingDriver, setEditingDriver] = useState<ValueDriver | null>(null);
  const [sessionService] = useState(() => new PlaygroundSessionService());

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await sessionService.loadSession(sessionId, organizationId);
        if (session?.data?.drivers) {
          setDrivers(session.data.drivers);
          setCanvasComponents(session.data.canvasComponents || []);
        }
      } catch (error) {
        logger.error('Failed to load session', { sessionId, organizationId, error });
      }
    };
    loadSession();
  }, [sessionId, organizationId, sessionService]);

  // Auto-save
  useEffect(() => {
    const autoSave = async () => {
      try {
        await sessionService.updateSession(sessionId, {
          data: { drivers, canvasComponents },
          organizationId,
        });
      } catch (error) {
        logger.error('Auto-save failed', { sessionId, error });
      }
    };
    const timeout = setTimeout(autoSave, 1000); // Auto-save after 1s
    return () => clearTimeout(timeout);
  }, [drivers, canvasComponents, sessionId, organizationId, sessionService]);

  const handleDrop = useCallback((item: { driver: ValueDriver }) => {
    const newDriver = { ...item.driver, id: `${item.driver.id}-${Date.now()}` };
    setDrivers(prev => [...prev, newDriver]);
    // Add to canvas components
    const component: CanvasComponent = {
      id: newDriver.id,
      type: 'valueDriver',
      props: { driver: newDriver, value: newDriver.defaultValue },
      position: { x: 0, y: 0 }, // Default position
    };
    setCanvasComponents(prev => [...prev, component]);
  }, []);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'valueDriver',
    drop: handleDrop,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const handleEditDriver = (driver: ValueDriver) => {
    setEditingDriver(driver);
  };

  const handleSaveDriver = (updatedDriver: ValueDriver) => {
    setDrivers(prev => prev.map(d => d.id === updatedDriver.id ? updatedDriver : d));
    setCanvasComponents(prev =>
      prev.map(c =>
        c.id === updatedDriver.id
          ? { ...c, props: { ...c.props, driver: updatedDriver } }
          : c
      )
    );
    setEditingDriver(null);
  };

  const handleDeleteDriver = (driverId: string) => {
    setDrivers(prev => prev.filter(d => d.id !== driverId));
    setCanvasComponents(prev => prev.filter(c => c.id !== driverId));
  };

  const handleValueChange = (componentId: string, newValue: any) => {
    setCanvasComponents(prev => {
      const updated = prev.map(c =>
        c.id === componentId ? { ...c, props: { ...c.props, value: newValue } } : c
      );
      // Trigger calculation cascade
      const updates = calculationEngine.calculateCascade(componentId, updated);
      updates.forEach(update => {
        const index = updated.findIndex(c => c.id === update.componentId);
        if (index !== -1) {
          updated[index] = { ...updated[index], props: { ...updated[index].props, value: update.newValue } };
        }
      });
      return [...updated];
    });
  };

  const handleExplicitSave = async () => {
    try {
      await sessionService.commitSession(sessionId, organizationId);
      onSave();
    } catch (error) {
      logger.error('Explicit save failed', { sessionId, error });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-full">
        <div
          ref={drop}
          className={`flex-1 p-4 border-2 border-dashed ${
            isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canvasComponents.map(component => (
              <ValueDriverCard
                key={component.id}
                component={component}
                onEdit={() => handleEditDriver(component.props.driver)}
                onDelete={() => handleDeleteDriver(component.id)}
                onValueChange={(value) => handleValueChange(component.id, value)}
              />
            ))}
          </div>
          {canvasComponents.length === 0 && (
            <div className="text-center text-gray-500">
              Drag value drivers here to start building your model
            </div>
          )}
        </div>
        <div className="w-80 p-4 border-l">
          <Button onClick={handleExplicitSave} className="w-full mb-4">
            Save to Backend
          </Button>
          {/* Library or other controls */}
        </div>
      </div>
      {editingDriver && (
        <ValueDriverEditor
          driver={editingDriver}
          onSave={handleSaveDriver}
          onClose={() => setEditingDriver(null)}
        />
      )}
    </DndProvider>
  );
};